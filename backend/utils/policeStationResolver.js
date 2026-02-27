const JURISDICTION_STATIONS = [
    "Governorpet - CRIME",
    "Krishnalanka - CRIME",
    "Machavaram - CRIME",
    "Patamata - CRIME",
    "Satyanarayanapuram - CRIME",
    "Suryaraopet - CRIME",
    "Vijayawada I Town - CRIME",
    "Vijayawada II Town - CRIME",
    "CCS, Vijayawada",
    "Cyber Crime",
    "Mahila UPS, Vijayawada",
    "Gunadala",
    "Machavaram",
    "Patamata",
    "Governorpet",
    "Krishnalanka",
    "Suryaraopet",
    "Ajith Singh Nagar",
    "Nunna",
    "Satyanarayanapuram",
    "Bhavanipuram",
    "Ibrahimpatnam",
    "Vijayawada I Town",
    "Vijayawada II Town",
    "Vijayawada Traffic I (T)",
    "Vijayawada Traffic II (T)",
    "Vijayawada Traffic III (T)",
    "Vijayawada Traffic IV (T)",
    "Vijayawada Traffic V (T)",
    "G. Konduru",
    "Mylavaram",
    "Reddigudem",
    "A. Konduru",
    "Gampalagudem",
    "Tiruvuru",
    "Vissannapet",
    "Nandigama",
    "Chillakallu",
    "Jaggaiahpet",
    "Penuganchiprolu",
    "Vatsavai",
    "Chandarlapadu",
    "Kanchikacherla",
    "Veerulapadu"
];

const OTHER_STATIONS_LABEL = "OTHER STATIONS";

function extractPoliceStation(rawText) {
    if (!rawText || typeof rawText !== 'string') return null;

    const normalized = rawText.replace(/\r/g, '');
    const headerSlice = normalized.slice(0, 1500);
    const patterns = [
        /\bP\.?\s*S\.?\s*[:\-]?\s*([^\n]{2,120})/i,
        /(?:^|\n)\s*Police\s*Station\s*[:\-]?\s*([^\n]{2,120})/i
    ];

    for (const pattern of patterns) {
        const match = headerSlice.match(pattern);
        if (!match || !match[1]) continue;

        const cleaned = match[1]
            .replace(/\s+/g, ' ')
            .replace(/[|]+/g, ' ')
            .replace(/\b(?:Year|FIR\s*No\.?|Date|Acts?|Section(?:s)?|District)\b.*$/i, '')
            .trim()
            .replace(/^[\s:.\-]+|[\s:.\-]+$/g, '');

        if (cleaned && cleaned.length >= 2) return cleaned;
    }

    const lines = headerSlice.split('\n').map(line => line.trim()).filter(Boolean);
    for (const line of lines) {
        if (!/P\.?\s*S\.?/i.test(line)) continue;
        if (/information\s+received\s+at\s+p\.?\s*s\.?/i.test(line)) continue;
        if (/name\s+of\s+p\.?\s*s\.?/i.test(line)) continue;

        const stripped = line.replace(/^.*?P\.?\s*S\.?\s*[:\-]?\s*/i, '').trim();
        const cleaned = stripped
            .replace(/\s+/g, ' ')
            .replace(/[|]+/g, ' ')
            .replace(/\b(?:Year|FIR\s*No\.?|Date|Acts?|Section(?:s)?|District)\b.*$/i, '')
            .trim()
            .replace(/^[\s:.\-]+|[\s:.\-]+$/g, '');

        if (cleaned && cleaned.length >= 2) return cleaned;
    }

    return null;
}

function normalizeStationName(name) {
    return (name || "")
        .toUpperCase()
        .replace(/[|]/g, " ")
        .replace(/[\.,]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function resolveCanonicalStation(rawText, _areaHint = null) {
    const extracted = extractPoliceStation(rawText);
    if (!extracted) return null;

    const station = normalizeStationName(extracted);

    if (station.includes("CYBER")) return "Cyber Crime";
    if (station.includes("CCS")) return "CCS, Vijayawada";
    if (station.includes("MAHILA")) return "Mahila UPS, Vijayawada";

    if (/\bTRAFFIC\s*I\b|\bTRAFIC\s*I\b/.test(station)) return "Vijayawada Traffic I (T)";
    if (/\bTRAFFIC\s*II\b/.test(station)) return "Vijayawada Traffic II (T)";
    if (/\bTRAFFIC\s*III\b/.test(station)) return "Vijayawada Traffic III (T)";
    if (/\bTRAFFIC\s*IV\b/.test(station)) return "Vijayawada Traffic IV (T)";
    if (/\bTRAFFIC\s*V\b/.test(station)) return "Vijayawada Traffic V (T)";

    if (/\bG\s*KONDURU\b|\bGONDURU\b/.test(station)) return "G. Konduru";
    if (/\bA\s*KONDURU\b/.test(station)) return "A. Konduru";
    if (station.includes("GAMPALAGUDEM")) return "Gampalagudem";
    if (station.includes("TIRUVURU")) return "Tiruvuru";
    if (station.includes("VISSANNAPET") || station.includes("VISSANNAPETA")) return "Vissannapet";
    if (station.includes("MYLAVARAM")) return "Mylavaram";
    if (station.includes("REDDIGUDEM")) return "Reddigudem";
    if (station.includes("NANDIGAMA")) return "Nandigama";
    if (station.includes("CHILLAKALLU")) return "Chillakallu";
    if (station.includes("JAGGAIAHPET") || station.includes("JAGGAIAHPETA") || station.includes("JAGGAIAHPET")) return "Jaggaiahpet";
    if (station.includes("PENUGANCHIPROLU")) return "Penuganchiprolu";
    if (station.includes("VATSAVAI") || station.includes("VATSVAI")) return "Vatsavai";
    if (station.includes("CHANDARLAPADU")) return "Chandarlapadu";
    if (station.includes("KANCHIKACHERLA")) return "Kanchikacherla";
    if (station.includes("VEERULAPADU")) return "Veerulapadu";

    if (station.includes("KRISHNALANKA") || station.includes("KRISHNA LANKA")) {
        return "Krishnalanka - CRIME";
    }
    if (station.includes("GOVERNORPET")) return "Governorpet - CRIME";
    if (station.includes("MACHAVARAM")) return "Machavaram - CRIME";
    if (station.includes("PATAMATA")) return "Patamata - CRIME";
    if (station.includes("SATYANARAYANAPURAM")) return "Satyanarayanapuram - CRIME";
    if (station.includes("SURYARAOPET")) return "Suryaraopet - CRIME";

    if (/\bI\s*TOWN\b|\b1\s*TOWN\b|\bI TOWN\b/.test(station)) {
        return "Vijayawada I Town - CRIME";
    }
    if (/\bII\s*TOWN\b|\b2\s*TOWN\b/.test(station)) {
        return "Vijayawada II Town - CRIME";
    }
    if (station.includes("VIJAYAWADA TOWN")) {
        return "Vijayawada I Town - CRIME";
    }

    if (station.includes("GUNADALA")) return "Gunadala";
    if (station.includes("AJITH") || station.includes("SINGH NAGAR") || station.includes("AS NAGAR")) return "Ajith Singh Nagar";
    if (station.includes("NUNNA")) return "Nunna";
    if (station.includes("BHAVANIPURAM")) return "Bhavanipuram";
    if (station.includes("IBRAHIMPATNAM")) return "Ibrahimpatnam";

    return null;
}

module.exports = {
    JURISDICTION_STATIONS,
    OTHER_STATIONS_LABEL,
    extractPoliceStation,
    resolveCanonicalStation
};
