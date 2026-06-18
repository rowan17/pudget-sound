const axios = require('axios');

// Station IDs for Puget Sound locations, in the desired display order.
const tideStations = {
    "Port Townsend": "9444900",
    "Blaine, Drayton Harbor": "9449679",
    "Bellingham": "9449211",
    "Rosario": "9449771",
    "Friday Harbor": "9449880",
    "Anacortes": "9448794",
    "Sequim Bay": "9444555",
    "Port Angeles": "9444090",
    "Neah Bay": "9443090",
    "Seattle": "9447130",
    "LaConner": "9448558",
    "Kayak Point": "9448094",
    "Everett": "9447659",
    "Port Ludlow": "9445017",
    "Pleasant Harbor": "9445293",
    "Bremerton": "9445958",
    "Tacoma, Sequin Waterway": "9446484",
    "Olympia": "9446807"
};

const currentStations = {
    "Lawrence Point": "PUG1708",
    "San Juan Channel": "PUG1703",
    "Rosario Strait": "PUG1702",
    "Deception Pass": "PUG1701",
    "Point Wilson": "PUG1623",
    "The Narrows": "PUG1524",
    "Dana Passage": "PUG1539"
};

// Formats a Date as the YYYYMMDD string the NOAA API expects.
function formatYmd(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}

/**
 * Splits an inclusive [start, end] date range into consecutive windows of at
 * most `maxDays` days each. NOAA's prediction backend times out (504) on large
 * spans and enforces hard per-request limits (e.g. 31 days for interval=h), so
 * we request the data in smaller chunks and stitch the results back together.
 * @param {Date} start
 * @param {Date} end
 * @param {number} maxDays - Maximum number of days per chunk.
 * @returns {Array<{begin: Date, end: Date}>}
 */
function chunkDateRange(start, end, maxDays) {
    const chunks = [];
    const final = new Date(end);
    let cursor = new Date(start);
    while (cursor <= final) {
        const chunkEnd = new Date(cursor);
        chunkEnd.setDate(chunkEnd.getDate() + maxDays - 1);
        if (chunkEnd > final) chunkEnd.setTime(final.getTime());
        chunks.push({ begin: new Date(cursor), end: new Date(chunkEnd) });
        cursor = new Date(chunkEnd);
        cursor.setDate(cursor.getDate() + 1);
    }
    return chunks;
}

// Base URL for NOAA Tides and Currents API
const API_BASE_URL = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter';

// Chunk sizes (in days) per product. The hourly product is capped at 31 days by
// NOAA; hilo/currents have larger limits but still time out on year-long spans.
const CHUNK_DAYS = { hilo: 90, hourly: 30, currents: 90 };

/**
 * Performs a GET request against the NOAA API with retries and exponential
 * backoff. NOAA frequently returns transient 504 (gateway timeout) responses
 * for large full-year requests, so we retry before giving up.
 * @param {object} params - Query parameters for the request.
 * @param {number} retries - Number of attempts before failing.
 * @returns {Promise<object>} - The response data.
 */
async function noaaGet(params, retries = 4) {
    let lastError;
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await axios.get(API_BASE_URL, { params, timeout: 60000 });
            if (response.data && response.data.error) {
                throw new Error(response.data.error.message || 'NOAA API error');
            }
            return response.data;
        } catch (error) {
            lastError = error;
            if (attempt < retries) {
                const delay = 1000 * Math.pow(2, attempt - 1); // 1s, 2s, 4s, ...
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    throw lastError;
}

/**
 * Fetches a date range in chunks and concatenates the extracted prediction
 * arrays. A failure on one chunk is logged but does not discard the others.
 * @param {object} baseParams - Query params excluding begin_date/end_date.
 * @param {Date} startDate
 * @param {Date} endDate
 * @param {number} maxDays - Chunk size in days.
 * @param {(data: object) => Array} extract - Pulls the array out of a response.
 * @param {string} label - Human-readable product name for error messages.
 * @returns {Promise<Array>} - The merged, in-order list of predictions.
 */
async function fetchInChunks(baseParams, startDate, endDate, maxDays, extract, label) {
    const merged = [];
    for (const { begin, end } of chunkDateRange(startDate, endDate, maxDays)) {
        const params = { ...baseParams, begin_date: formatYmd(begin), end_date: formatYmd(end) };
        try {
            const data = await noaaGet(params);
            const arr = extract(data);
            if (Array.isArray(arr)) merged.push(...arr);
        } catch (error) {
            console.error(`Error fetching ${label} for station ${baseParams.station} (${formatYmd(begin)} to ${formatYmd(end)}):`, error.message);
        }
    }
    return merged;
}

// --- Fetch Functions ---

/**
 * Fetches tide predictions for a given station.
 * @param {string} stationId - The ID of the tide station.
 * @param {Date} startDate - The start date for which to fetch data.
 * @param {Date} endDate - The end date for which to fetch data.
 * @returns {Promise<object>} - A promise that resolves with the tide data.
 */
async function fetchTideData(stationId, startDate, endDate) {
    const baseParams = {
        application: 'Puget_Sound_Tide_Book',
        format: 'json',
        product: 'predictions',
        datum: 'MLLW',
        time_zone: 'lst_ldt',
        units: 'english',
        interval: 'hilo',
        station: stationId,
    };
    const predictions = await fetchInChunks(
        baseParams, startDate, endDate, CHUNK_DAYS.hilo,
        data => data.predictions, 'tide data'
    );
    return { predictions };
}

 /**
  * Fetches hourly tide predictions for a given station.
  * @param {string} stationId - The ID of the tide station.
  * @param {Date} startDate - The start date for which to fetch data.
  * @param {Date} endDate - The end date for which to fetch data.
  * @returns {Promise<object>} - A promise that resolves with the hourly tide data.
  */
 async function fetchHourlyTideData(stationId, startDate, endDate) {
    const baseParams = {
        application: 'Puget_Sound_Tide_Book',
        format: 'json',
        product: 'predictions',
        datum: 'MLLW',
        time_zone: 'lst_ldt',
        units: 'english',
        interval: 'h', // Hourly interval
        station: stationId,
    };
    const predictions = await fetchInChunks(
        baseParams, startDate, endDate, CHUNK_DAYS.hourly,
        data => data.predictions, 'hourly tide data'
    );
    return { predictions };
 }
 
 /**
  * Fetches current predictions for a given station.
  * @param {string} stationId - The ID of the current station.
  * @param {Date} startDate - The start date for which to fetch data.
  * @param {Date} endDate - The end date for which to fetch data.
  * @returns {Promise<object>} - A promise that resolves with the current data.
  */
 async function fetchCurrentData(stationId, startDate, endDate) {
    const baseParams = {
        application: 'Puget_Sound_Tide_Book',
        format: 'json',
        product: 'currents_predictions',
        time_zone: 'lst_ldt',
        units: 'english',
        interval: 'max_slack',
        station: stationId,
    };
    const cp = await fetchInChunks(
        baseParams, startDate, endDate, CHUNK_DAYS.currents,
        data => data.current_predictions && data.current_predictions.cp, 'current data'
    );
    return { current_predictions: { cp } };
}

// --- Main Execution ---

async function main() {
    console.log("--- Fetching Tide Data ---");
    for (const [name, id] of Object.entries(tideStations)) {
        const data = await fetchTideData(id);
        console.log(`\n${name} (Station: ${id})`);
        if (data && data.predictions) {
            data.predictions.forEach(p => {
                console.log(`  ${p.type === 'H' ? 'High' : 'Low'}: ${p.v} ft at ${p.t}`);
            });
        } else {
            console.log("  No data found.");
        }
    }

    console.log("\n--- Fetching Current Data ---");
    for (const [name, id] of Object.entries(currentStations)) {
        const data = await fetchCurrentData(id);
        console.log(`\n${name} (Station: ${id})`);
        // The response for currents has a 'current_predictions' key
        if (data && data.current_predictions && data.current_predictions.cp) {
            data.current_predictions.cp.forEach(p => {
                // Map the event type to the book's terminology
                let eventType = '';
                if (p.Type === 'slack') eventType = 'Slack';
                else if (p.Type === 'ebb') eventType = 'Max Ebb';
                else if (p.Type === 'flood') eventType = 'Max Flood';
                else eventType = p.Type; // Fallback

                console.log(`  ${eventType}: ${p.Velocity_Major} knots at ${p.Time}`);
            });
        } else {
            console.log("  No data found or error in response.");
        }
    }
}

// --- Exports and Main Execution ---

// Export the functions and data for use in other scripts
module.exports = {
    fetchTideData,
    fetchHourlyTideData,
    fetchCurrentData,
    tideStations,
    currentStations
};

// Run the main function only when the script is executed directly
if (require.main === module) {
    main();
}
