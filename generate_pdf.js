const PDFDocument = require('pdfkit');
const fs = require('fs');
const { fetchTideData, fetchHourlyTideData, fetchCurrentData, tideStations, currentStations } = require('./fetch_data.js');
const SunCalc = require('suncalc');
const QuickChart = require('quickchart-js');
const moonPhases = require('./moon_phases.js');

function formatTime(dateTimeString) {
    if (!dateTimeString || typeof dateTimeString !== 'string') return '';
    const parts = dateTimeString.split(' ');
    return parts.length === 2 ? parts[1] : '';
}

/**
 * Draws a moon phase icon directly onto the PDF using SVG paths.
 * @param {PDFDocument} doc - The PDF document instance.
 * @param {number} x - The x-coordinate for the center of the icon.
 * @param {number} y - The y-coordinate for the center of the icon.
 * @param {number} phase - The moon illumination phase (0 to 1).
 * @param {number} radius - The radius of the moon icon.
 */
function drawMoonIcon(doc, x, y, phase, radius) {
    doc.save();

    const light = '#E0E0E0';
    const dark = '#201F24';

    // Always draw the dark circle background
    doc.circle(x, y, radius).fill(dark);

    const phaseName = getMoonPhaseName(phase).toLowerCase().replace(' ', '_');
    let path;

    if (phaseName === 'new_moon') {
        // Already dark, do nothing
    } else if (phaseName === 'full_moon') {
        doc.circle(x, y, radius).fill(light);
    } else {
        path = moonPhases[phaseName];
        if (path) {
            // The paths are for a 100x100 box. We need to scale and translate.
            const scale = radius / 50;
            doc.translate(x - radius, y - radius).scale(scale);
            doc.path(path).fill(light);
        }
    }

    doc.restore();
}

async function generateTideGraph(hourlyData, hiloData, width, height) {
    if (!hourlyData || hourlyData.length === 0) return null;

    const labels = hourlyData.map(p => formatTime(p.t));
    const values = hourlyData.map(p => parseFloat(p.v));

    const hiloLabels = {};
    hiloData.forEach(p => {
        const time = formatTime(p.t);
        const label = `${p.type}${parseFloat(p.v).toFixed(1)}`;
        hiloLabels[time] = label;
    });

    const chart = new QuickChart();
    chart.setWidth(width).setHeight(height).setBackgroundColor('white');
    chart.setConfig({
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                fill: false,
                borderColor: 'black',
                borderWidth: 1,
                pointRadius: 2,
                pointBackgroundColor: 'black',
                datalabels: {}
            }]
        },
        options: {
            plugins: {
                datalabels: {
                    display: (context) => !!context.chart.options.plugins.datalabels.customLabels[context.chart.data.labels[context.dataIndex]],
                    formatter: (value, context) => context.chart.options.plugins.datalabels.customLabels[context.chart.data.labels[context.dataIndex]] || '',
                    align: 'top',
                    color: 'black',
                    font: {
                        size: 8
                    },
                    customLabels: hiloLabels
                }
            },
            legend: {
                display: false
            },
            title: {
                display: false
            },
            scales: {
                xAxes: [{
                    gridLines: {
                        display: true,
                        color: '#e0e0e0'
                    },
                    ticks: {
                        fontSize: 8,
                        fontColor: 'black',
                        autoSkip: true,
                        maxTicksLimit: 5
                    }
                }],
                yAxes: [{
                    display: false
                }]
            }
        }
    });

    return chart.toDataUrl();
}

async function generatePdf() {
    const testMode = false;
    const graphStations = { "Port Townsend": true, "Seattle": true };
    
    const pageWidth = 306;
    const pageHeight = 792;
    const margin = 10;
    const dividerX = pageWidth * 0.45;

    const sizes = {
        headerLg: 14, headerSm: 8, title: 10, stationName: 9, data: 8,
        lineSpacing: 2, stationSpacing: 6, graphHeight: 40, graphBottomMargin: 3,
        tideLineHeight: 9, moonIconRadius: 9
    };

    const year = 2026;
    const startDate = new Date(year, 0, 1);
    const endDate = testMode ? startDate : new Date(year, 11, 31);

    const doc = new PDFDocument({ size: [pageWidth, pageHeight], margin: 0 });
    doc.pipe(fs.createWriteStream('PugetSound_Tide_Book_Page.pdf'));

    console.log('Fetching data...');
    const allCurrentData = {};
    for (const [name, id] of Object.entries(currentStations)) {
        allCurrentData[name] = await fetchCurrentData(id, startDate, endDate);
    }
    const allTideData = {};
    const allHourlyTideData = {};
    for (const [name, id] of Object.entries(tideStations)) {
        allTideData[name] = await fetchTideData(id, startDate, endDate);
        if (graphStations[name]) {
            allHourlyTideData[name] = await fetchHourlyTideData(id, startDate, endDate);
        }
    }
    console.log('Data fetched successfully.');

    for (let day = new Date(startDate); day <= endDate; day.setDate(day.getDate() + 1)) {
        const date = new Date(day);
        if (day > startDate) doc.addPage();

        const sunTimes = SunCalc.getTimes(date, 47.6, -122.3);
        const sunrise = sunTimes.sunrise.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const sunset = sunTimes.sunset.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const moonIllumination = SunCalc.getMoonIllumination(date);
        const moonPhaseName = getMoonPhaseName(moonIllumination.phase);

        doc.fontSize(sizes.headerLg).font('Helvetica-Bold').text(date.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase(), margin, margin);
        doc.fontSize(sizes.headerLg).font('Helvetica-Bold').text(date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }).toUpperCase(), margin, margin + sizes.headerLg);
        
        drawMoonIcon(doc, pageWidth / 2, margin + sizes.moonIconRadius, moonIllumination.phase, sizes.moonIconRadius);
        doc.fontSize(sizes.headerSm).font('Helvetica').text(moonPhaseName, pageWidth / 2 - 30, margin + sizes.moonIconRadius * 2 + 2, { width: 60, align: 'center' });

        doc.fontSize(sizes.headerSm).font('Helvetica')
           .text(`SUNRISE ${sunrise}`, 0, margin + 3, { align: 'right', width: pageWidth - margin })
           .text(`SUNSET ${sunset}`, 0, margin + 15, { align: 'right', width: pageWidth - margin });

        let currentY = margin + 40;
        doc.fontSize(sizes.title).font('Helvetica-Bold')
           .text('CURRENT PREDICTIONS', margin, currentY, { width: dividerX - margin, align: 'center', underline: true })
           .text('HIGH AND LOW TIDES', dividerX, currentY, { width: pageWidth - dividerX - margin, align: 'center', underline: true });
        currentY += sizes.title + 5;
        doc.moveTo(dividerX, currentY - 2).lineTo(dividerX, pageHeight - margin).stroke();

        const dayString = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
        
        let currentsY = currentY;
        for (const [name, id] of Object.entries(currentStations)) {
            doc.fontSize(sizes.stationName).font('Helvetica-Bold').text(name, margin, currentsY, { width: dividerX - margin * 2, align: 'center' });
            currentsY += sizes.stationName;
            const currentsForDay = (allCurrentData[name]?.current_predictions?.cp || []).filter(p => p.Time.startsWith(dayString));
            if (currentsForDay.length > 0) {
                currentsForDay.forEach(p => {
                    const eventType = p.Type === 'ebb' ? 'max ebb' : (p.Type === 'flood' ? 'max flood' : 'slack');
                    let speed = parseFloat(p.Velocity_Major).toFixed(1);
                    if (eventType === 'slack') speed = '';
                    const time = formatTime(p.Time);
                    
                    const colWidth = (dividerX - margin) / 3;
                    doc.fontSize(sizes.data).font('Helvetica').text(speed, margin, currentsY, { width: colWidth, align: 'center' });
                    doc.fontSize(sizes.data).font('Helvetica').text(eventType, margin + colWidth, currentsY, { width: colWidth, align: 'center' });
                    doc.fontSize(sizes.data).font('Helvetica').text(time, margin + colWidth * 2, currentsY, { width: colWidth, align: 'center' });
                    currentsY += sizes.data + sizes.lineSpacing;
                });
            } else {
                doc.fontSize(sizes.data).font('Helvetica-Oblique').text('Data not available.', margin, currentsY, { width: dividerX - margin * 2, align: 'center' });
                currentsY += sizes.data;
            }
            currentsY += sizes.stationSpacing;
        }

        let tidesY = currentY;
        for (const [name, id] of Object.entries(tideStations)) {
            const tidesForDay = (allTideData[name]?.predictions || []).filter(p => p.t.startsWith(dayString));
            
            if (graphStations[name]) {
                const hourlyData = (allHourlyTideData[name]?.predictions || []).filter(p => p.t.startsWith(dayString));
                const graphDataUrl = await generateTideGraph(hourlyData, tidesForDay, (pageWidth - dividerX - margin * 2) * 2, sizes.graphHeight * 2);
                if (graphDataUrl) {
                    doc.image(graphDataUrl, dividerX + margin, tidesY, { width: pageWidth - dividerX - margin * 2 });
                    tidesY += sizes.graphHeight + sizes.graphBottomMargin;
                }
            }

            doc.fontSize(sizes.stationName).font('Helvetica-Bold').text(name, dividerX, tidesY, { width: pageWidth - dividerX, align: 'center' });
            tidesY += sizes.stationName;

            if (tidesForDay.length > 0) {
                const numEntries = tidesForDay.length;
                const colWidth = (pageWidth - dividerX - margin) / numEntries;
                const startOffset = (numEntries < 4) ? ((pageWidth - dividerX - margin) - (numEntries * colWidth)) / 2 : 0;

                const heightTypeLineY = tidesY;
                const timeLineY = tidesY + sizes.tideLineHeight;
                tidesForDay.forEach((p, index) => {
                    const time = formatTime(p.t);
                    const height = parseFloat(p.v).toFixed(2);
                    const type = p.type === 'H' ? 'high' : 'low';
                    const colX = dividerX + startOffset + (index * colWidth);
                    doc.fontSize(sizes.data).font('Helvetica')
                       .text(`${height} ${type}`, colX, heightTypeLineY, { width: colWidth, align: 'center' })
                       .text(time, colX, timeLineY, { width: colWidth, align: 'center' });
                });
                tidesY += sizes.tideLineHeight * 2;
            } else {
                doc.fontSize(sizes.data).font('Helvetica-Oblique').text('Data not available.', dividerX, tidesY, { width: pageWidth - dividerX, align: 'center' });
                tidesY += sizes.data;
            }
            tidesY += sizes.stationSpacing;
        }
    }
    doc.end();
    console.log('\nPDF generated: PugetSound_Tide_Book_Page.pdf');
}

function getMoonPhaseName(phase) {
    if (phase < 0.0625) return 'New Moon';
    if (phase < 0.1875) return 'Waxing Crescent';
    if (phase < 0.3125) return 'First Quarter';
    if (phase < 0.4375) return 'Waxing Gibbous';
    if (phase < 0.5625) return 'Full Moon';
    if (phase < 0.6875) return 'Waning Gibbous';
    if (phase < 0.8125) return 'Last Quarter';
    if (phase < 0.9375) return 'Waning Crescent';
    return 'New Moon';
}

generatePdf();
