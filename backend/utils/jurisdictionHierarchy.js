/**
 * Jurisdiction Hierarchy
 * Maps DCPs to their respective Zones/Circles and Police Stations.
 *
 * EXCLUSIVE_DCP_ORDER defines the priority for exclusive record assignment.
 * Each FIR record is assigned to exactly ONE DCP (the first match in this order).
 */
const jurisdictionMapping = {
    "DCP CRIMES": {
        "Vijayawada CCS Circle": [
            "Governorpet (Crime)",
            "Krishnalanka (Crime)",
            "Machavaram (Crime)",
            "Patamata (Crime)",
            "Satyanarayanapuram (Crime)",
            "Suryaraopet (Crime)",
            "Vijayawada I Town (Crime)",
            "Vijayawada II Town (Crime)"
        ],
        "Other Crime Units": [
            "CCS, Vijayawada",
            "Cyber Crime"
        ]
    },
    "DCP LAW & ORDER - 1": {
        "Vijayawada Central Zone": [
            "Gunadala",
            "Machavaram",
            "Patamata"
        ],
        "Vijayawada South Zone": [
            "Governorpet",
            "Krishnalanka",
            "Suryaraopet",
            "Krishna Lanka",
            "KrishnaLanka"
        ],
        "Mahila UPS": [
            "Mahila UPS, Vijayawada"
        ],
        "Vijayawada Generic Area (Unknown Zone)": [
            "Vijayawada",
            "Vijayawada East",
            "Vijayawada City",
            "Vijayawada city",
            "Labbipet, Vijayawada",
            "NTR Commissionerate",
            "Madhura Nagar"
        ]
    },
    "DCP LAW & ORDER - 2": {
        "Vijayawada North Zone": [
            "Ajith Singh Nagar",
            "Nunna",
            "Satyanarayanapuram",
            "Ajithsingh Nagar",
            "AS Nagar",
            "Singh Nagar",
            "Prasadampadu",
            "Enikepadu",
            "Nidamanuru",
            "Ramavarappadu",
            "Payakapuram",
            "Prakash Nagar, Payakapuram",
            "Kandrika, Payakapuram",
            "Nunna Village, Vijayawada Rural",
            "Nunna Village, Nuzivid Road, Vijayawada Rural",
            "Auto Nagar"
        ],
        "Vijayawada West Zone": [
            "Bhavanipuram",
            "Ibrahimpatnam",
            "Ibrahimpatnam Mandal",
            "Ibrahimpatnam mandal",
            "Ibrahimpatnam Village and Mandal",
            "West Ibrahimpatnam, Ibrahimpatnam",
            "Guntupalli Village, Ibrahimpatnam Mandal",
            "Vijayawada I Town",
            "Vijayawada II Town",
            "I Town",
            "Vidyadharapuram",
            "Kummaripalem",
            "Gollapudi, Vijayawada Rural",
            "Gollapudi",
            "Ambapuram panchayathi"
        ],
        "Vijayawada Rural (Generic/West)": [
            "Vijayawada Rural",
            "Vijayawada rural",
            "Vjayawada rural",
            "Vijayawada Rural Mandal",
            "Vijayawada rural Mandal"
        ]
    },
    "DCP TRAFFIC": {
        "Vijayawada Traffic Zone": [
            "Vijayawada Traffic I (T)",
            "Vijayawada Traffic II (T)",
            "Vijayawada Traffic III (T)",
            "Vijayawada Traffic IV (T)",
            "Vijayawada Traffic V (T)"
        ]
    },
    "MYLAVARAM SDPO": {
        "Mylavaram Circle": [
            "G. Konduru",
            "G Konduru Mandal",
            "G. Konduru Mandal",
            "Konduru Mandal",
            "Vellaturu Village, G. Konduru Mandal",
            "Mylavaram",
            "Mylavaram Village and Mandal",
            "Mylavaram Mandal",
            "MVARAM BEAT NO-1",
            "MVARAM BEAT NO-3",
            "Reddigudem",
            "Reddigudem Mandal",
            "Naguluru Village, Reddigudem Mandal"
        ],
        "Tiruvuru Circle": [
            "A. Konduru",
            "A Konduru",
            "A. Konduru Mandal",
            "A.Konduru Mandal",
            "A Konduru Mandal",
            "A Konduru mandal",
            "A Konduru village and A Konduru mandal",
            "Gopalapuram Village, A Konduru Mandal",
            "Gampalagudem",
            "Gampalagudem Mandal",
            "Gampalagudem Village and Mandal",
            "Gampalagduem Mandal",
            "Penugolanu Village, Gampalagudem Mandal",
            "Tiruvuru",
            "Vissannapet",
            "Vissannapeta Mandal",
            "Vissannapeta Town"
        ]
    },
    "NANDIGAMA SDPO": {
        "Nandigama": [
            "Nandigama",
            "Nandigama Mandal",
            "Nandigama mandal",
            "Nandigama town",
            "Nandigama town & Mandal",
            "Nandigama Town and Mandal"
        ],
        "Jaggaiahpet Circle": [
            "Chillakallu",
            "Jaggaiahpet",
            "Jaggaiahpet mandal",
            "Jaggaiahpet Mandal",
            "Jaggaihapeta Mandal",
            "Penuganchiprolu",
            "Penuganchiprolu Mandal",
            "Penuganchiprolu Village & Mandal",
            "Penuganchiprolu Village and Mandal",
            "Nawabpeta Village, Penuganchiprolu Mandal",
            "Lingagudem Village, Penuganchiprolu Mandal",
            "Vatsavai",
            "Vatsavai Mandal",
            "Vatsavai mandal",
            "Vatsvai mandal",
            "Vatsavai Village & Mandal"
        ],
        "Nandigama Rural Circle": [
            "Chandarlapadu",
            "Chandarlapadu Mandal",
            "Kanchikacherla",
            "Kanchikacherla Mandal",
            "Kanchikacherla Village and Mandal",
            "Kanchikacherla mandal",
            "Paritala village, Kanchikacherla",
            "Keesara Village, Kanchikacherla Mandal",
            "Vemulaplli Village, Kanchikacherla Mandal",
            "Veerulapadu",
            "Veerulapadu Mandal",
            "Kotha Repudi Village",
            "THotacharla",
            "Gudlavalleru Mandal"
        ]
    }
};

/**
 * Priority order for exclusive DCP assignment.
 * DCP CRIMES comes first so its shared stations get counted under Crimes.
 * Records are assigned to the FIRST matching DCP in this order.
 */
const EXCLUSIVE_DCP_ORDER = [
    "DCP CRIMES",
    "DCP TRAFFIC",
    "MYLAVARAM SDPO",
    "NANDIGAMA SDPO",
    "DCP LAW & ORDER - 2",
    "DCP LAW & ORDER - 1"
];

/**
 * Given a query string (could be a DCP, Zone/Circle, or Station),
 * returns a flat array of all matching leaf police stations.
 */
const getStationsForQuery = (queryName) => {
    let stations = [];
    if (jurisdictionMapping[queryName]) {
        const zones = jurisdictionMapping[queryName];
        for (const zone in zones) {
            stations.push(...zones[zone]);
        }
    } else {
        let found = false;
        for (const dcp in jurisdictionMapping) {
            if (jurisdictionMapping[dcp][queryName]) {
                stations = [...jurisdictionMapping[dcp][queryName]];
                found = true;
                break;
            }
        }
        if (!found) {
            stations = [queryName];
        }
    }

    return stations.map(s => {
        return s.replace(/ \(Crime\)$/i, '')
                .replace(/ \(T\)$/i, '')
                .replace(/, Vijayawada$/i, '')
                .trim();
    });
};

/**
 * Build a PostgreSQL regex pattern for a station name.
 * Generic city-level terms use exact anchored match; specific stations use word-boundary.
 */
const GENERIC_TERMS = ['vijayawada', 'vijayawada city', 'vijayawada rural', 'ntr commissionerate'];

const buildAreaPattern = (stationName) => {
    const lower = stationName.toLowerCase();
    if (GENERIC_TERMS.includes(lower)) {
        return `^${stationName}$`;
    }
    return `\\y${stationName}\\y`;
};

/**
 * Build a SQL WHERE clause fragment that matches l.area against a set of stations.
 * Only matches against l.area (NOT l.city) to prevent broad false positives.
 * Returns { sql: string, params: string[] } with parameterized placeholders starting from paramOffset.
 */
const buildAreaCondition = (stations, paramOffset = 1) => {
    const conditions = stations.map((_, i) => `l.area ~* $${paramOffset + i}`);
    const sql = `(${conditions.join(' OR ')})`;
    const params = stations.map(buildAreaPattern);
    return { sql, params };
};

/**
 * For exclusive DCP assignment: returns the SQL condition and params for a given DCP,
 * EXCLUDING records that belong to higher-priority DCPs (per EXCLUSIVE_DCP_ORDER).
 */
const buildExclusiveCondition = (dcpName) => {
    const idx = EXCLUSIVE_DCP_ORDER.indexOf(dcpName);
    const higherPriority = idx > 0 ? EXCLUSIVE_DCP_ORDER.slice(0, idx) : [];

    const targetStations = getStationsForQuery(dcpName);
    const include = buildAreaCondition(targetStations, 1);

    if (higherPriority.length === 0) {
        return { sql: include.sql, params: include.params };
    }

    const excludeStations = [];
    higherPriority.forEach(dcp => excludeStations.push(...getStationsForQuery(dcp)));

    const exclude = buildAreaCondition(excludeStations, targetStations.length + 1);
    return {
        sql: `${include.sql} AND NOT ${exclude.sql}`,
        params: [...include.params, ...exclude.params]
    };
};

/**
 * Returns the full hierarchical tree for the frontend.
 */
const getJurisdictionTree = () => {
    return jurisdictionMapping;
};

module.exports = {
    jurisdictionMapping,
    getStationsForQuery,
    getJurisdictionTree,
    buildAreaCondition,
    buildExclusiveCondition,
    EXCLUSIVE_DCP_ORDER,
    GENERIC_TERMS
};
