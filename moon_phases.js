const moonPhases = {
    // Paths are for a 100x100 viewbox, centered at (50,50).
    // They will be scaled and translated to the correct position and size.
    waxing_crescent: "M 50 0 A 50 50 0 0 1 50 100 A 30 50 0 0 0 50 0 Z",
    first_quarter: "M 50 0 L 50 100 A 50 50 0 0 0 50 0 Z",
    waxing_gibbous: "M 50 0 A 50 50 0 0 1 50 100 A -30 50 0 0 1 50 0 Z",
    waning_gibbous: "M 50 0 A 50 50 0 0 0 50 100 A -30 50 0 0 0 50 0 Z",
    last_quarter: "M 50 0 L 50 100 A 50 50 0 0 1 50 0 Z",
    waning_crescent: "M 50 0 A 50 50 0 0 0 50 100 A 30 50 0 0 1 50 0 Z",
};

module.exports = moonPhases;
