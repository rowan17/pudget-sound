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

// Function to get today's date in the required format (YYYYMMDD)
function getFormattedDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}

// Base URL for NOAA Tides and Currents API
const API_BASE_URL = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter';

// --- Fetch Functions ---

/**
 * Fetches tide predictions for a given station.
 * @param {string} stationId - The ID of the tide station.
 * @param {Date} startDate - The start date for which to fetch data.
 * @param {Date} endDate - The end date for which to fetch data.
 * @returns {Promise<object>} - A promise that resolves with the tide data.
 */
async function fetchTideData(stationId, startDate, endDate) {
    const begin_date = `${startDate.getFullYear()}${(startDate.getMonth() + 1).toString().padStart(2, '0')}${startDate.getDate().toString().padStart(2, '0')}`;
    const end_date = `${endDate.getFullYear()}${(endDate.getMonth() + 1).toString().padStart(2, '0')}${endDate.getDate().toString().padStart(2, '0')}`;
    const params = {
        application: 'Puget_Sound_Tide_Book',
        format: 'json',
        product: 'predictions',
        datum: 'MLLW',
        time_zone: 'lst_ldt',
        units: 'english',
        interval: 'hilo',
        station: stationId,
        begin_date,
        end_date,
    };

    try {
        const response = await axios.get(API_BASE_URL, { params });
        return response.data;
    } catch (error) {
        console.error(`Error fetching tide data for station ${stationId} for dates ${begin_date} to ${end_date}:`, error.message);
        return { predictions: [] }; // Return an empty array for predictions on error
    }
}
 
 /**
  * Fetches hourly tide predictions for a given station.
  * @param {string} stationId - The ID of the tide station.
  * @param {Date} startDate - The start date for which to fetch data.
  * @param {Date} endDate - The end date for which to fetch data.
  * @returns {Promise<object>} - A promise that resolves with the hourly tide data.
  */
 async function fetchHourlyTideData(stationId, startDate, endDate) {
    const begin_date = `${startDate.getFullYear()}${(startDate.getMonth() + 1).toString().padStart(2, '0')}${startDate.getDate().toString().padStart(2, '0')}`;
    const end_date = `${endDate.getFullYear()}${(endDate.getMonth() + 1).toString().padStart(2, '0')}${endDate.getDate().toString().padStart(2, '0')}`;
    const params = {
        application: 'Puget_Sound_Tide_Book',
        format: 'json',
        product: 'predictions',
        datum: 'MLLW',
        time_zone: 'lst_ldt',
        units: 'english',
        interval: 'h', // Hourly interval
        station: stationId,
        begin_date,
        end_date,
    };
 
    try {
        const response = await axios.get(API_BASE_URL, { params });
        return response.data;
    } catch (error) {
        console.error(`Error fetching hourly tide data for station ${stationId} for dates ${begin_date} to ${end_date}:`, error.message);
        return { predictions: [] }; // Return an empty array for predictions on error
    }
 }
 
 /**
  * Fetches current predictions for a given station.
  * @param {string} stationId - The ID of the current station.
  * @param {Date} startDate - The start date for which to fetch data.
  * @param {Date} endDate - The end date for which to fetch data.
  * @returns {Promise<object>} - A promise that resolves with the current data.
  */
 async function fetchCurrentData(stationId, startDate, endDate) {
    const begin_date = `${startDate.getFullYear()}${(startDate.getMonth() + 1).toString().padStart(2, '0')}${startDate.getDate().toString().padStart(2, '0')}`;
    const end_date = `${endDate.getFullYear()}${(endDate.getMonth() + 1).toString().padStart(2, '0')}${endDate.getDate().toString().padStart(2, '0')}`;
    const params = {
        application: 'Puget_Sound_Tide_Book',
        format: 'json',
        product: 'currents_predictions',
        time_zone: 'lst_ldt',
        units: 'english',
        interval: 'max_slack',
        station: stationId,
        begin_date,
        end_date,
    };

    try {
        const response = await axios.get(API_BASE_URL, { params });
        return response.data;
    } catch (error) {
        console.error(`Error fetching current data for station ${stationId} for dates ${begin_date} to ${end_date}:`, error.message);
        return { current_predictions: { cp: [] } }; // Return an empty array for current predictions on error
    }
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
