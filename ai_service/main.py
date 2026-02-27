import shutil
import os
import json
import io
import traceback
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pdfplumber
from PIL import Image
from typing import Optional, List
from pydantic import BaseModel
import re
from dotenv import load_dotenv

load_dotenv()

# ========== Neo4j Graph Database Setup ==========
from neo4j_connection import init_neo4j, close_neo4j, get_neo4j
from graph_ingestion import ingest_fir_to_graph, ingest_batch, get_graph_stats, clear_graph

# ========== NetworkX Graph Analysis Setup ==========
try:
    import networkx as nx
    from graph_analysis import (
        build_networkx_graph,
        compute_centrality,
        detect_communities,
        find_connections,
        analyze_hotspots,
        graph_summary,
    )
    HAS_NETWORKX = True
    print("✅ NetworkX graph analysis engine loaded")
except ImportError as e:
    HAS_NETWORKX = False
    print(f"⚠️ NetworkX not available — analysis endpoints disabled: {e}")

# ========== ML Predictions Setup ==========
try:
    from ml_predictions import (
        train_severity_model,
        predict_severity,
        predict_hotspots as ml_predict_hotspots,
        detect_anomalies,
    )
    HAS_ML = True
    print("✅ ML predictions engine loaded")
except ImportError as e:
    HAS_ML = False
    print(f"⚠️ ML predictions not available: {e}")

# ========== Google Vision API Setup ==========
from google.cloud import vision
from google.oauth2 import service_account

# Path to the service account JSON key
CREDENTIALS_PATH = os.path.join(os.path.dirname(__file__), "google_credentials.json")
GOOGLE_CREDENTIALS_JSON = os.getenv("GOOGLE_CREDENTIALS_JSON")
# Support for API Key
GOOGLE_VISION_API_KEY = os.getenv("GOOGLE_VISION_API_KEY")

vision_client = None

try:
    if GOOGLE_VISION_API_KEY:
        print(f"🔑 Loading credentials from GOOGLE_VISION_API_KEY environment variable")
        vision_client = vision.ImageAnnotatorClient(
            client_options={"api_key": GOOGLE_VISION_API_KEY}
        )
        print("✅ Google Vision API client initialized with API Key")
    elif os.path.exists(CREDENTIALS_PATH):
        print(f"🔑 Loading credentials from file: {CREDENTIALS_PATH}")
        credentials = service_account.Credentials.from_service_account_file(CREDENTIALS_PATH)
        vision_client = vision.ImageAnnotatorClient(credentials=credentials)
        print("✅ Google Vision API client initialized")
    elif GOOGLE_CREDENTIALS_JSON:
        print("🔑 Loading credentials from GOOGLE_CREDENTIALS_JSON environment variable")
        creds_dict = json.loads(GOOGLE_CREDENTIALS_JSON)
        credentials = service_account.Credentials.from_service_account_info(creds_dict)
        vision_client = vision.ImageAnnotatorClient(credentials=credentials)
        print("✅ Google Vision API client initialized")
    else:
        print(f"⚠️ Google credentials not found at {CREDENTIALS_PATH} or in GOOGLE_CREDENTIALS_JSON env var")
except Exception as e:
    print(f"⚠️ Google Vision API setup failed: {e}")

# ========== SpaCy Setup ==========
nlp = None
try:
    import spacy
    nlp = spacy.load("en_core_web_sm")
    print("✅ SpaCy model loaded")
except Exception as e:
    print(f"⚠️ SpaCy not available, regex-only mode: {e}")

# ========== Translation Setup ==========
HAS_TRANSLATOR = False
try:
    from deep_translator import GoogleTranslator
    from langdetect import detect
    HAS_TRANSLATOR = True
    print("✅ Translation libraries loaded")
except ImportError:
    print("⚠️ Translation libraries not available")

# ========== Threshold for scanned page detection ==========
SCANNED_PAGE_THRESHOLD = 200  # chars — if extracted text < this, page is likely scanned or poor quality

def is_form_boilerplate_dense(text: str) -> bool:
    """Detect if the text is mostly just form headers without actual content."""
    if not text: return True
    labels = ["first information report", "district", "ps:", "p.s.", "year", "date", "time", "acts", "sections"]
    found_labels = [l for l in labels if l in text.lower()]
    # If we find many labels but the text is short, it's probably just a form header
    return len(found_labels) >= 3 and len(text.strip()) < 500

# ========== FastAPI App ==========
app = FastAPI(title="FIR Analysis AI Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ========== Lifecycle Events ==========
@app.on_event("startup")
async def startup_event():
    """Initialize Neo4j on startup."""
    neo4j_ok = init_neo4j()
    if neo4j_ok:
        print("✅ Neo4j graph database connected")
    else:
        print("💡 Neo4j unavailable — Neural Prototype Fallback Active (Demo Mode)")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup Neo4j on shutdown."""
    close_neo4j()
    print("🔌 Neo4j connection closed")


# ========== Data Models ==========
class Victim(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    injury: Optional[str] = None

class Vehicle(BaseModel):
    type: Optional[str] = None
    number: Optional[str] = None
    driver_name: Optional[str] = None

class Location(BaseModel):
    address: Optional[str] = None
    area: Optional[str] = None
    city: str = "Vijayawada"
    lat: Optional[float] = None
    lng: Optional[float] = None

class FIRData(BaseModel):
    fir_number: str
    date_time: str
    cause: Optional[str] = None
    severity: str
    location: Location
    victims: List[Victim] = []
    vehicles: List[Vehicle] = []
    confidence_score: float
    raw_text: Optional[str] = None


# ========== Health Check ==========
@app.get("/")
async def health():
    neo4j = get_neo4j()
    return {
        "status": "ok",
        "service": "FIR Analysis AI",
        "vision_api": "enabled" if vision_client else "disabled",
        "spacy": "enabled" if nlp else "disabled",
        "translator": "enabled" if HAS_TRANSLATOR else "disabled",
        "neo4j": "enabled" if neo4j.is_connected else "disabled",
        "networkx": "enabled" if HAS_NETWORKX else "disabled",
        "ml_predictions": "enabled" if HAS_ML else "disabled",
    }


# ========== Main Processing Endpoint ==========
@app.post("/process_fir", response_model=FIRData)
async def process_fir(file: UploadFile = File(...)):
    temp_path = f"temp_{file.filename}"

    try:
        # Save uploaded file
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        file_size = os.path.getsize(temp_path)
        print(f"\n{'='*60}")
        print(f"📄 Processing: {file.filename} ({file_size} bytes)")
        print(f"{'='*60}")

        # ===== Step 1: Smart Text Extraction =====
        text = smart_extract_text(temp_path)

        if not text or len(text.strip()) < 10:
            print("⚠️ Could not extract any text from this PDF")
            return FIRData(
                fir_number="UNKNOWN",
                date_time="UNKNOWN",
                cause="Could not extract text from PDF",
                severity="Unknown",
                location=Location(address="Unknown", city="Vijayawada"),
                victims=[],
                vehicles=[],
                confidence_score=0.0
            )

        print(f"\n📝 Total extracted text ({len(text)} chars):")
        print(f"   Preview: {text[:300]}...")

        # HTML Check
        if "<!doctype html" in text.lower() or "<html" in text.lower():
             print("❌ HTML/Error Page detected instead of FIR PDF. Skipping.")
             return FIRData(
                fir_number="INVALID_FILE",
                date_time="UNKNOWN",
                cause="Corrupt File (HTML/Error Page)",
                severity="Unknown",
                location=Location(address="Unknown", city="Vijayawada"),
                victims=[],
                vehicles=[],
                confidence_score=0.0
            )

        # ===== Step 2: Language Detection & Translation =====
        if HAS_TRANSLATOR:
            try:
                if is_telugu(text):
                    print("🔤 Telugu detected — translating to English...")
                    # Translate in chunks (Google Translate has a limit)
                    translated = translate_text(text)
                    if translated:
                        text = translated
                        print("✅ Translation complete")
            except Exception as e:
                print(f"⚠️ Translation failed (continuing with original text): {e}")

        # ===== Step 3: Information Extraction =====
        extracted_data = extract_information(text)
        extracted_data.raw_text = text  # Include raw text for LLM processing
        
        print(f"\n✅ Extraction complete:")
        print(f"   FIR: {extracted_data.fir_number}")
        print(f"   Confidence: {extracted_data.confidence_score}")

        return extracted_data

    except Exception as e:
        print(f"❌ Error processing FIR: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


# ========================================================================
# SMART TEXT EXTRACTION
# ========================================================================

def smart_extract_text(pdf_path: str) -> str:
    """
    Extract text from PDF using smart strategy.
    """
    all_text = ""
    typed_pages = 0
    scanned_pages = 0

    try:
        with pdfplumber.open(pdf_path) as pdf:
            total_pages = len(pdf.pages)
            print(f"📖 PDF has {total_pages} page(s)")

            for i, page in enumerate(pdf.pages):
                page_num = i + 1
                is_critical_page = (page_num == 1 or page_num == total_pages)

                # Step 1: Try free text extraction first
                page_text = page.extract_text() or ""
                text_len = len(page_text.strip())

                # FORCE Vision API for all pages to ensure "Full Detailed Analysis"
                needs_vision = True
                print(f"   Page {page_num}: 🚨 High-Quality Mode — Using Vision API for OCR")

                if needs_vision:
                    ocr_text = ocr_page_with_vision(page)
                    if ocr_text:
                        all_text += ocr_text + "\n"
                        scanned_pages += 1
                    else:
                        print(f"   ⚠️ Vision API failed/empty, falling back to pdfplumber")
                        all_text += page_text + "\n"
                        typed_pages += 1
                else:
                    # ✅ Typed page — use free extracted text
                    print(f"   Page {page_num}: ✅ Typed ({text_len} chars) — FREE extraction")
                    all_text += page_text + "\n"
                    typed_pages += 1

        print(f"\n📊 Extraction summary: {typed_pages} typed + {scanned_pages} scanned = {typed_pages + scanned_pages} pages processed")

    except Exception as e:
        print(f"⚠️ pdfplumber failed: {e}")
        # Last resort: try reading as raw text
        try:
            with open(pdf_path, 'r', errors='ignore') as f:
                all_text = f.read()
                print(f"   Fallback: read as raw text ({len(all_text)} chars)")
        except:
            pass

    return all_text


def ocr_page_with_vision(page) -> str:
    if not vision_client:
        return ""

    try:
        page_image = page.to_image(resolution=300)
        pil_image = page_image.original

        img_byte_arr = io.BytesIO()
        pil_image.save(img_byte_arr, format='PNG')
        img_bytes = img_byte_arr.getvalue()

        image = vision.Image(content=img_bytes)
        image_context = vision.ImageContext(language_hints=["en", "te"])
        response = vision_client.text_detection(image=image, image_context=image_context)

        if response.error.message:
            return ""

        texts = response.text_annotations
        if texts:
            return texts[0].description
        return ""

    except Exception:
        return ""


# ========================================================================
# TRANSLATION
# ========================================================================

def is_telugu(text: str) -> bool:
    if not HAS_TRANSLATOR: return False
    try:
        return detect(text[:500]) == 'te'
    except:
        return False

def translate_text(text: str) -> str:
    try:
        translator = GoogleTranslator(source='te', target='en')
        chunk_size = 4500
        chunks = [text[i:i+chunk_size] for i in range(0, len(text), chunk_size)]
        translated_chunks = [translator.translate(chunk) for chunk in chunks]
        return " ".join(translated_chunks)
    except:
        return text


# ========================================================================
# INFORMATION EXTRACTION (Regex + NLP)
# ========================================================================

def extract_information(text: str) -> FIRData:
    BLACKLIST_PHRASES = [
        "reasons for delay in reporting", "delay in reporting", "complainant", "informant",
        "first information report", "ion report", "p.s.", "police station", "under section",
        "acts & sections", "occurrence of offence", "information received at p.s.",
        "station house officer", "sho", "dated", "time", "landmark"
    ]
    
    # 1. FIR Number
    fir_patterns = [
        r"FIR\s*No\.?\s*[:\-]?\s*([A-Z0-9/\-]+)",
        r"Crime\s*No\.?\s*[:\-]?\s*([A-Z0-9/\-]+)",
    ]
    fir_number = "UNKNOWN"
    for pattern in fir_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            fir_number = match.group(1).strip()
            break

    # 2. Date and Time
    date_patterns = [
        r"(\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\s+\d{1,2}:\d{2}(?::\d{2})?)",
        r"(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})",
    ]
    date_time = "UNKNOWN"
    for pattern in date_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            date_time = match.group(1).strip()
            break

    # 3. Location
    locations = []
    if nlp:
        doc = nlp(text[:5000])
        locations = [ent.text for ent in doc.ents if ent.label_ in ["GPE", "LOC", "FAC"]]

    loc_patterns = [
        r"(?:Location|Place|Address|Near|At)\s*[:\-]?\s*(.+?)(?:\n|$)",
    ]
    loc_address = ""
    for pattern in loc_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            val = match.group(1).strip()
            if not any(bp in val.lower() for bp in BLACKLIST_PHRASES if len(bp) > 5):
                loc_address = val[:200]
                break

    if not loc_address:
        loc_address = ", ".join(locations[:3]) if locations else "Vijayawada"

    location_obj = Location(
        address=loc_address,
        area=locations[0] if locations else "Vijayawada",
        city="Vijayawada",
        lat=16.5062,
        lng=80.6480
    )

    # 4. Severity
    severity = "Non-Fatal"
    if re.search(r"death|dead|fatal|killed|died|expire|deceased", text, re.IGNORECASE):
        severity = "Fatal"
    elif re.search(r"grievous|serious|critical|severe|fracture", text, re.IGNORECASE):
        severity = "Grievous"

    # 5. Cause
    cause = "Under Investigation"
    cause_patterns = [
        r"(?:cause|reason)\s*[:\-]?\s*(.+?)(?:\n|\.)",
        r"(over\s*speed(?:ing)?|rash\s*driv(?:ing)?|drunk\s*driv(?:ing)?|negligent)",
    ]
    for pattern in cause_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            val = match.group(1).strip() if match.lastindex else match.group(0).strip()
            if not any(bp in val.lower() for bp in BLACKLIST_PHRASES):
                cause = val
                break
    
    if cause == "Under Investigation" or any(bp in cause.lower() for bp in BLACKLIST_PHRASES):
        cause = "Under Investigation"

    # 6. Victims
    victims = []
    age_matches = re.findall(r"Age\s*[:\-]?\s*(\d{1,3})", text, re.IGNORECASE)
    gender_matches = re.findall(r"Gender\s*[:\-]?\s*(Male|Female)", text, re.IGNORECASE)

    for i in range(max(len(age_matches), len(gender_matches), 1)):
        if i < len(age_matches) or i < len(gender_matches):
            victims.append(Victim(
                age=int(age_matches[i]) if i < len(age_matches) else None,
                gender=gender_matches[i] if i < len(gender_matches) else None,
                injury="Unknown"
            ))

    # 7. Vehicles
    vehicles = []
    veh_patterns = [
        r"(?:Vehicle\s*No\.?\s*[:\-]?\s*|Registration\s*No\.?\s*[:\-]?\s*|Reg\.?\s*No\.?\s*[:\-]?\s*)([A-Z]{2}\s?\d{1,2}\s?[A-Z]{0,3}\s?\d{1,4})",
    ]
    veh_numbers_found = set()
    for pattern in veh_patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        for v in matches:
            clean = re.sub(r'\s+', '', v.upper())
            if len(clean) >= 6:
                veh_numbers_found.add(clean)

    for v in veh_numbers_found:
        vehicles.append(Vehicle(type="Unknown", number=v, driver_name="Unknown"))

    fields_found = sum([
        fir_number != "UNKNOWN",
        date_time != "UNKNOWN",
        severity != "Non-Fatal",
        cause != "Under Investigation",
        len(victims) > 0,
        len(vehicles) > 0,
        loc_address != "Unknown" and loc_address != "",
    ])
    confidence = round(fields_found / 7.0, 2)

    return FIRData(
        fir_number=fir_number,
        date_time=date_time,
        cause=cause,
        severity=severity,
        location=location_obj,
        victims=victims,
        vehicles=vehicles,
        confidence_score=max(confidence, 0.1)
    )


# ========== Graph API Endpoints ==========

@app.get("/graph/health")
async def graph_health():
    """Check Neo4j graph database health and statistics."""
    neo4j = get_neo4j()
    return neo4j.health_check()


class GraphIngestRequest(BaseModel):
    """Request body for single FIR graph ingestion."""
    id: Optional[int] = None
    fir_number: str
    incident_date: Optional[str] = None
    reported_date: Optional[str] = None
    cause: Optional[str] = None
    severity: Optional[str] = "Unknown"
    confidence_score: Optional[float] = 0.0
    status: Optional[str] = "Processed"
    raw_text: Optional[str] = None
    location: Optional[dict] = None
    victims: Optional[list] = []
    vehicles: Optional[list] = []


@app.post("/graph/ingest")
async def graph_ingest(data: GraphIngestRequest):
    """Ingest a single FIR record into the Neo4j graph."""
    result = ingest_fir_to_graph(data.dict())
    if result["status"] == "error":
        raise HTTPException(status_code=500, detail=result.get("error"))
    return result


@app.post("/graph/ingest-batch")
async def graph_ingest_batch(records: List[GraphIngestRequest]):
    """Ingest a batch of FIR records into the Neo4j graph."""
    fir_dicts = [r.dict() for r in records]
    result = ingest_batch(fir_dicts)
    return result


@app.get("/graph/stats")
async def graph_stats():
    """Get graph database statistics."""
    return get_graph_stats()


@app.delete("/graph/clear")
async def graph_clear():
    """⚠️ Clear all nodes and relationships from the graph. Use with caution!"""
    return clear_graph()


# ========== NetworkX Analysis API Endpoints ==========

@app.get("/analysis/summary")
async def analysis_summary():
    """High-level structural summary of the crime graph."""
    if not HAS_NETWORKX:
        raise HTTPException(status_code=503, detail="NetworkX not available")
    G = build_networkx_graph()
    return graph_summary(G)


@app.get("/analysis/centrality")
async def analysis_centrality(top_n: int = 10):
    """
    Compute centrality scores for all nodes. Returns top-N most influential nodes.
    """
    if not HAS_NETWORKX:
        raise HTTPException(status_code=503, detail="NetworkX not available")
    G = build_networkx_graph()
    return compute_centrality(G, top_n=top_n)


@app.get("/analysis/communities")
async def analysis_communities():
    """
    Detect crime clusters using greedy modularity community detection.
    """
    if not HAS_NETWORKX:
        raise HTTPException(status_code=503, detail="NetworkX not available")
    G = build_networkx_graph()
    return detect_communities(G)


@app.get("/analysis/hotspots")
async def analysis_hotspots_api(top_n: int = 10):
    """
    Rank locations by FIR count and weighted danger score.
    """
    if not HAS_NETWORKX:
        raise HTTPException(status_code=503, detail="NetworkX not available")
    G = build_networkx_graph()
    return analyze_hotspots(G, top_n=top_n)


@app.get("/analysis/connections")
async def analysis_connections(node_a: Optional[str] = None, node_b: Optional[str] = None, limit: int = 500):
    """
    Find shortest path between two nodes, or return list of all links if nodes not specified.
    """
    if not HAS_NETWORKX:
        raise HTTPException(status_code=503, detail="NetworkX not available")
    
    G = build_networkx_graph()
    
    # CASE 1: Pathfinding between two specific nodes
    if node_a and node_b:
        return find_connections(node_a, node_b, G)
    
    # CASE 2: Get all links (for visualizer proxy)
    edges = []
    for u, v, data in G.edges(data=True):
        edges.append({
            "source": u,
            "target": v,
            "rel_type": data.get("rel_type")
        })
        if len(edges) >= limit:
            break
            
    return {"connections": edges}


# ========== ML Prediction API Endpoints ==========

class SeverityPredictRequest(BaseModel):
    fir_number: Optional[str] = None
    incident_date: Optional[str] = None
    cause: Optional[str] = None
    victims: Optional[list] = []
    vehicles: Optional[list] = []
    confidence_score: Optional[float] = 0.0


@app.post("/ml/train")
async def ml_train():
    """
    Train the severity classification model using current graph data.
    Re-train whenever new FIRs are ingested.
    """
    if not HAS_ML:
        raise HTTPException(status_code=503, detail="ML not available")
    if not HAS_NETWORKX:
        raise HTTPException(status_code=503, detail="NetworkX not available")
    G = build_networkx_graph()
    result = train_severity_model(G)
    return result


@app.post("/ml/predict-severity")
async def ml_predict_severity(data: SeverityPredictRequest):
    """
    Predict severity (Fatal / Grievous / Non-Fatal) for a given FIR.
    Trains model automatically if not already done.
    """
    if not HAS_ML:
        raise HTTPException(status_code=503, detail="ML not available")
    G = build_networkx_graph() if HAS_NETWORKX else None
    return predict_severity(data.dict(), G)


@app.get("/ml/predict-hotspots")
async def ml_hotspots(top_n: int = 10):
    """
    Predict and rank next likely accident hotspot locations using a
    composite risk model (FIR history + severity + graph centrality).
    """
    if not HAS_ML:
        raise HTTPException(status_code=503, detail="ML not available")
    if not HAS_NETWORKX:
        raise HTTPException(status_code=503, detail="NetworkX not available")
    G = build_networkx_graph()
    return ml_predict_hotspots(G, top_n=top_n)


@app.get("/ml/detect-anomalies")
async def ml_anomalies(contamination: float = 0.1):
    """
    Detect anomalous FIRs using Isolation Forest.
    Anomalies have unusual combinations of time, location, victims, vehicles, etc.
    contamination: expected fraction of anomalies (0.0 – 0.5, default 0.1)
    """
    if not HAS_ML:
        raise HTTPException(status_code=503, detail="ML not available")
    if not HAS_NETWORKX:
        raise HTTPException(status_code=503, detail="NetworkX not available")
    if not 0.01 <= contamination <= 0.5:
        raise HTTPException(status_code=400, detail="contamination must be between 0.01 and 0.5")
    G = build_networkx_graph()
    return detect_anomalies(G, contamination=contamination)


# ========== Run Server ==========

if __name__ == "__main__":
    import uvicorn
    print("\n🚀 Starting FIR Analysis AI Service...")
    print(f"   Vision API: {'✅ Enabled' if vision_client else '❌ Disabled'}")
    print(f"   SpaCy NLP:  {'✅ Enabled' if nlp else '❌ Disabled'}")
    print(f"   Translator: {'✅ Enabled' if HAS_TRANSLATOR else '❌ Disabled'}")
    print(f"   Neo4j:      {'✅ Enabled' if True else '❌ Disabled'}")
    print(f"   NetworkX:   {'✅ Enabled' if HAS_NETWORKX else '❌ Disabled'}")
    print(f"   ML Models:  {'✅ Enabled' if HAS_ML else '❌ Disabled'}")
    print()
    uvicorn.run(app, host="0.0.0.0", port=8000)
