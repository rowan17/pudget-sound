# Tide and Current Book Page Formatting

This document details the formatting of a page from a tide and current book for Puget Sound, with the goal of recreating it using a script and API data from NOAA.

## I. Overall Page Layout

The page is divided into three main sections:

1.  **Header**: Contains the date, moon phase, and sunrise/sunset times.
2.  **Current Predictions**: A single column on the left side of the page.
3.  **High and Low Tides**: A single column on the right side of the page.

The layout is clean, using a sans-serif font (likely Helvetica or Arial) and a clear visual hierarchy. A vertical line separates the "Current Predictions" and "High and Low Tides" sections.

## II. Header Section

The header is at the top of the page and contains the following elements:

*   **Date**:
    *   "WEDNESDAY" is in a smaller font size than "JAN. 1".
    *   "JAN. 1" is in a large, bold, all-caps font.
*   **Moon Phase**:
    *   An icon representing the new moon is displayed.
    *   "New Moon" is written below the icon.
*   **Sunrise/Sunset**:
    *   "SUNRISE" and "SUNSET" are in all caps.
    *   The times are listed to the right of "SUNRISE" and "SUNSET".

## III. Current Predictions Section

This section is on the left side of the page and has the following formatting:

*   **Title**: "CURRENT PREDICTIONS" is in a bold, all-caps font with a double underline.
*   **Location Blocks**:
    *   Each location (e.g., "Lawrence Point", "San Juan Channel") is a block of data.
    *   The location name is in a bold, title-case font.
    *   The data is presented in a table-like format with three columns:
        1.  **Current Speed (knots)**: A signed floating-point number (e.g., `3.1`, `-0.4`).
        2.  **Current Type**: "max flood", "slack", or "max ebb".
        3.  **Time (HH:MM)**: The time of the prediction in 24-hour format.

## IV. High and Low Tides Section

This section is on the right side of the page and has the following formatting:

*   **Title**: "HIGH AND LOW TIDES" is in a bold, all-caps font with a double underline.
*   **Tide Graphs**:
    *   Some locations have a line graph that visualizes the tide levels over a 24-hour period.
    *   The y-axis represents the tide height (in feet), and the x-axis represents the time.
*   **Location Blocks**:
    *   Each location (e.g., "Port Townsend", "Blaine, Drayton Harbor") is a block of data.
    *   The location name is in a bold, title-case font.
    *   The data is presented with the tide height, type ("high" or "low"), and time, for example: `9.52 high 06:49`.
    *   There can be up to four tide events listed for each location per day.

## V. Fonts and Typography

*   **Primary Font**: A sans-serif font is used throughout the page.
*   **Headings**: Headings are in bold and all caps.
*   **Location Names**: Location names are in bold and title case.
*   **Data**: The data is in a regular weight font.

## VI. Data Representation for Scripting

When recreating this page with a script, the data from the NOAA API will need to be structured as follows:

*   **Current Predictions**: A list of objects, where each object represents a location and contains a list of current predictions. Each prediction should have a `speed`, `type`, and `time`.
*   **High and Low Tides**: A list of objects, where each object represents a location and contains a list of tide events. Each event should have a `height`, `type` ("high" or "low"), and `time`.

This structured data can then be used to generate the page with the formatting described above, likely using a library for generating PDFs or HTML.