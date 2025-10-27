const PDFDocument = require('pdfkit');
const fs = require('fs');
const { fetchTideData, fetchHourlyTideData, fetchCurrentData, tideStations, currentStations } = require('./fetch_data.js');
const SunCalc = require('suncalc');
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

function drawTideGraph(doc, hiloData, x, y, width, height) {
    if (!hiloData || hiloData.length < 2) return;

    doc.save();
    doc.translate(x, y);

    const points = hiloData.map(p => ({
        time: new Date(p.t).getTime(),
        value: parseFloat(p.v)
    }));

    const minTime = points[0].time;
    const maxTime = points[points.length - 1].time;
    const timeRange = maxTime - minTime;

    const values = points.map(p => p.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const valueRange = maxValue - minValue;

    const timeToX = (time) => ((time - minTime) / timeRange) * width;
    const valueToY = (value) => height - ((value - minValue) / valueRange) * (height * 0.8) - (height * 0.1);

    // Draw grid lines
    doc.lineWidth(0.5).strokeColor('#e0e0e0');
    for (let i = 0; i <= 4; i++) {
        const lineY = (height / 4) * i;
        doc.moveTo(0, lineY).lineTo(width, lineY).stroke();
    }
    const midY = valueToY(0);
    doc.lineWidth(0.5).strokeColor('black').moveTo(0, midY).lineTo(width, midY).stroke();


    // Draw curve
    doc.lineWidth(1).strokeColor('black');
    const firstPoint = points[0];
    doc.moveTo(timeToX(firstPoint.time), valueToY(firstPoint.value));
    for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        const x1 = timeToX(p1.time);
        const y1 = valueToY(p1.value);
        const x2 = timeToX(p2.time);
        const y2 = valueToY(p2.value);
        const cp1x = x1 + (x2 - x1) / 2;
        const cp2x = x1 + (x2 - x1) / 2;
        doc.bezierCurveTo(cp1x, y1, cp2x, y2, x2, y2);
    }
    doc.stroke();

    // Draw points and labels
    const avgValue = values.reduce((a, b) => a + b, 0) / values.length;
    points.forEach((p, index) => {
        const px = timeToX(p.time);
        const py = valueToY(p.value);
        doc.circle(px, py, 2).fill('black');

        const label = parseFloat(p.value).toFixed(2);
        const isVisuallyHigh = p.value > avgValue;
        const labelY = isVisuallyHigh ? py + 4 : py - 10;
        
        doc.fontSize(5).fill('black').font('Helvetica-Bold').text(label, px - 10, labelY, { width: 20, align: 'center' });
    });

    // Draw X-axis labels (e.g., 06:00, 12:00, 18:00)
    const hours = [6, 12, 18];
    const dayStart = new Date(points[0].time);
    dayStart.setHours(0, 0, 0, 0);

    hours.forEach(hour => {
        const labelTime = new Date(dayStart.getTime());
        labelTime.setHours(hour);
        if (labelTime.getTime() >= minTime && labelTime.getTime() <= maxTime) {
            const labelX = timeToX(labelTime.getTime());
            // Draw vertical line
            doc.lineWidth(0.5).strokeColor('#e0e0e0').moveTo(labelX, 0).lineTo(labelX, height).stroke();
            // Draw label
            doc.fontSize(7).fill('black').font('Helvetica-Bold').text(`${String(hour).padStart(2, '0')}:00`, labelX - 15, height + 2, { width: 30, align: 'center' });
        }
    });

    doc.restore();
}


async function generatePdf() {
    const testMode = true;
    const graphStations = { "Port Townsend": true, "Seattle": true };
    
    const pageWidth = 288;
    const pageHeight = 576;
    const margin = 10;
    const dividerX = pageWidth * 0.45;

    const sizes = {
        headerLg: 11, headerSm: 6, title: 8, stationName: 7, data: 6,
        lineSpacing: 0.5, stationSpacing: 2, graphHeight: 30, graphBottomMargin: 2,
        tideLineHeight: 7, moonIconRadius: 7
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

        doc.fontSize(sizes.headerLg).font('Helvetica-Bold').text(date.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase(), margin + 13, margin);
        doc.fontSize(sizes.headerLg).font('Helvetica-Bold').text(date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }).toUpperCase(), margin + 13, margin + sizes.headerLg);
        
        drawMoonIcon(doc, pageWidth / 2, margin + sizes.moonIconRadius, moonIllumination.phase, sizes.moonIconRadius);
        doc.fontSize(sizes.headerSm).font('Helvetica').text(moonPhaseName, pageWidth / 2 - 30, margin + sizes.moonIconRadius * 2 + 2, { width: 60, align: 'center' });

        doc.fontSize(sizes.headerSm).font('Helvetica')
           .text(`SUNRISE ${sunrise}`, 0, margin + 3, { align: 'right', width: pageWidth - margin })
           .text(`SUNSET ${sunset}`, 0, margin + 10, { align: 'right', width: pageWidth - margin });

        let currentY = margin + 25;
        doc.font('Helvetica-Bold').fontSize(sizes.title)
           .text('CURRENT PREDICTIONS', margin, currentY, { width: dividerX - margin, align: 'center' })
           .text('HIGH AND LOW TIDES', dividerX, currentY, { width: pageWidth - dividerX - margin, align: 'center' });
        
        const underlineY = currentY + sizes.title + 1;
        doc.lineWidth(1).moveTo(margin, underlineY).lineTo(dividerX - margin, underlineY).stroke();
        doc.lineWidth(1).moveTo(dividerX + margin, underlineY).lineTo(pageWidth - margin, underlineY).stroke();

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
            
            if (graphStations[name] && tidesForDay.length > 0) {
                drawTideGraph(doc, tidesForDay, dividerX + margin, tidesY, pageWidth - dividerX - margin * 2, sizes.graphHeight);
                tidesY += sizes.graphHeight + sizes.graphBottomMargin + 8; // Add extra space for x-axis labels
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
