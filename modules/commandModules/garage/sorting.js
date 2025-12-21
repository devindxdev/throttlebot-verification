function extractYearFromName(name) {
    if (!name) return null;
    const match = `${name}`.match(/(19|20)\d{2}/);
    if (!match) return null;
    const year = parseInt(match[0], 10);
    if (!Number.isFinite(year) || year < 1900 || year > 2099) return null;
    return year;
}

function compareByYearAsc(a, b) {
    const yearA = extractYearFromName(a.vehicle);
    const yearB = extractYearFromName(b.vehicle);

    if (yearA === null && yearB === null) return 0;
    if (yearA === null) return 1; // missing years go last
    if (yearB === null) return -1;

    if (yearA !== yearB) return yearA - yearB;
    return (a.vehicle || '').localeCompare(b.vehicle || '');
}

function compareByYearDesc(a, b) {
    const yearA = extractYearFromName(a.vehicle);
    const yearB = extractYearFromName(b.vehicle);

    if (yearA === null && yearB === null) return 0;
    if (yearA === null) return 1; // missing years go last
    if (yearB === null) return -1;

    if (yearA !== yearB) return yearB - yearA;
    return (a.vehicle || '').localeCompare(b.vehicle || '');
}

function sortGarageData(garageData, preference = 'default') {
    if (!Array.isArray(garageData)) return [];
    const data = [...garageData];

    if (preference === 'year-asc') {
        return data.sort(compareByYearAsc);
    }
    if (preference === 'year-desc') {
        return data.sort(compareByYearDesc);
    }
    return data;
}

module.exports = { sortGarageData, extractYearFromName };
