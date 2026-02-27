const db = require('./backend/db');
const { getStationsForQuery } = require('./backend/utils/jurisdictionHierarchy');

async function findUnmapped() {
  const result = await db.query('SELECT a.id, a.fir_number, l.area, l.city FROM accidents a LEFT JOIN locations l ON a.id = l.accident_id');
  
  // Get all known leaf stations from top-level DCPs/SDPOs
  const dcpList = ['DCP CRIMES', 'DCP LAW & ORDER - 1', 'DCP LAW & ORDER - 2', 'DCP TRAFFIC', 'MYLAVARAM SDPO', 'NANDIGAMA SDPO'];
  let allKnown = [];
  dcpList.forEach(dcp => {
    allKnown.push(...getStationsForQuery(dcp));
  });

  const isMatch = (cleanedSearch, dbArea, dbCity) => {
    const genericTerms = ['vijayawada', 'vijayawada city', 'vijayawada rural', 'ntr commissionerate'];
    if (genericTerms.includes(cleanedSearch)) {
      return dbArea === cleanedSearch || dbCity === cleanedSearch;
    }
    // Simple logic for script analysis
    try {
      const regex = new RegExp('\\b' + cleanedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
      return regex.test(dbArea) || regex.test(dbCity);
    } catch {
      return dbArea.includes(cleanedSearch) || dbCity.includes(cleanedSearch);
    }
  };

  const unmapped = result.rows.filter(row => {
    const dbArea = (row.area || '').toLowerCase();
    const dbCity = (row.city || '').toLowerCase();
    
    // Check if it matches ANY known station
    const matchesAny = allKnown.some(station => {
      const cleaned = station.replace(/ \(Crime\)$/i, '').replace(/ \(T\)$/i, '').replace(/, Vijayawada$/i, '').trim().toLowerCase();
      return isMatch(cleaned, dbArea, dbCity);
    });
    
    return !matchesAny;
  });

  console.log('Total records:', result.rows.length);
  console.log('Unmapped records:', unmapped.length);
  
  const unmappedAreas = unmapped.map(u => u.area || u.city || 'Unknown');
  const counts = {};
  unmappedAreas.forEach(a => counts[a] = (counts[a] || 0) + 1);
  
  const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]);
  console.log('Top unmapped areas:', sorted.slice(0, 50));
}

(async () => {
  try {
    await findUnmapped();
  } catch (err) {
    console.error(err);
  } finally {
    await db.pool.end(); 
  }
})();
