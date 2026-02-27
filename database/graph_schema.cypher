// ============================================================
// CrimeGraph AI — Neo4j Graph Schema
// ============================================================
// This file defines the graph data model for FIR relationship mapping.
// Run this against your Neo4j instance to create constraints and indexes.

// ==================== CONSTRAINTS ====================
// Ensure unique identifiers for core nodes

CREATE CONSTRAINT fir_unique_number IF NOT EXISTS
FOR (f:FIR) REQUIRE f.fir_number IS UNIQUE;

CREATE CONSTRAINT person_unique_id IF NOT EXISTS
FOR (p:Person) REQUIRE p.person_id IS UNIQUE;

CREATE CONSTRAINT vehicle_unique_id IF NOT EXISTS
FOR (v:Vehicle) REQUIRE v.vehicle_id IS UNIQUE;

CREATE CONSTRAINT location_unique_id IF NOT EXISTS
FOR (l:Location) REQUIRE l.location_id IS UNIQUE;

// ==================== INDEXES ====================
// Performance indexes for frequently queried properties

CREATE INDEX fir_date_idx IF NOT EXISTS
FOR (f:FIR) ON (f.incident_date);

CREATE INDEX fir_severity_idx IF NOT EXISTS
FOR (f:FIR) ON (f.severity);

CREATE INDEX fir_cause_idx IF NOT EXISTS
FOR (f:FIR) ON (f.cause);

CREATE INDEX location_area_idx IF NOT EXISTS
FOR (l:Location) ON (l.area);

CREATE INDEX location_city_idx IF NOT EXISTS
FOR (l:Location) ON (l.city);

CREATE INDEX location_coords_idx IF NOT EXISTS
FOR (l:Location) ON (l.latitude, l.longitude);

CREATE INDEX person_name_idx IF NOT EXISTS
FOR (p:Person) ON (p.name);

CREATE INDEX vehicle_number_idx IF NOT EXISTS
FOR (v:Vehicle) ON (v.vehicle_number);

CREATE INDEX vehicle_type_idx IF NOT EXISTS
FOR (v:Vehicle) ON (v.vehicle_type);

// ==================== NODE LABELS & PROPERTIES ====================
//
// (:FIR)
//   - fir_number: STRING (unique)
//   - incident_date: DATETIME
//   - reported_date: DATETIME
//   - cause: STRING
//   - severity: STRING (Fatal | Grievous | Non-Fatal | Unknown)
//   - confidence_score: FLOAT
//   - status: STRING
//   - postgres_id: INTEGER (reference to PostgreSQL accidents table)
//
// (:Person)
//   - person_id: STRING (unique, generated)
//   - name: STRING
//   - age: INTEGER
//   - gender: STRING
//   - role: STRING (Victim | Driver | Complainant)
//
// (:Vehicle)
//   - vehicle_id: STRING (unique, generated or vehicle_number)
//   - vehicle_number: STRING
//   - vehicle_type: STRING
//   - driver_name: STRING
//
// (:Location)
//   - location_id: STRING (unique, generated)
//   - address: STRING
//   - area: STRING
//   - city: STRING
//   - latitude: FLOAT
//   - longitude: FLOAT
//
// (:CrimeType)
//   - name: STRING (e.g., "Road Accident", "Hit and Run")
//

// ==================== RELATIONSHIPS ====================
//
// (:FIR)-[:OCCURRED_AT]->(:Location)
//   Properties: primary (BOOLEAN)
//
// (:FIR)-[:INVOLVES_PERSON]->(:Person)
//   Properties: role (STRING: "victim", "driver", "complainant")
//
// (:FIR)-[:INVOLVES_VEHICLE]->(:Vehicle)
//   Properties: role (STRING: "offending", "victim")
//
// (:FIR)-[:CLASSIFIED_AS]->(:CrimeType)
//
// (:Person)-[:DRIVES]->(:Vehicle)
//
// (:Person)-[:INJURED_IN]->(:FIR)
//   Properties: injury_severity (STRING), is_fatality (BOOLEAN)
//
// (:Location)-[:NEAR]->(:Location)
//   Properties: distance_km (FLOAT)
//
// (:FIR)-[:RELATED_TO]->(:FIR)
//   Properties: relation_type (STRING), similarity_score (FLOAT)
//

// ==================== SAMPLE CRIME TYPES ====================
MERGE (:CrimeType {name: "Road Accident"});
MERGE (:CrimeType {name: "Hit and Run"});
MERGE (:CrimeType {name: "Drunk Driving"});
MERGE (:CrimeType {name: "Rash Driving"});
MERGE (:CrimeType {name: "Over Speeding"});
MERGE (:CrimeType {name: "Signal Violation"});
MERGE (:CrimeType {name: "Wrong Side Driving"});
MERGE (:CrimeType {name: "Negligent Driving"});
MERGE (:CrimeType {name: "Unknown"});
