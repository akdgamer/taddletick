// Wall-mounted shell for a Raspberry Pi 4 + 3.5" SPI touch display (the Taddletick desk display).
//
// Two parts, both printed without supports:
//   PART = "base"  - tray: Pi on 4 posts, port openings, SD notch, keyhole wall slots, vents
//   PART = "lid"   - frame: screen window; slides over the base like a sleeve
// The sleeve absorbs a few mm of uncertainty in how high the display sits; two optional
// M3 screws through the lid's vertical slots lock it once it rests on the glass.
//
// Coordinates follow the Pi board: x along the 85 mm edge (USB/Ethernet at x=85),
// y along the 56 mm edge (power + HDMI at y=0, GPIO header at y=56), z up from the wall.
// Hung on the wall with y=0 at the bottom: cables leave downwards and to the right.
//
// openscad -D 'PART="base"' -o base.stl taddletick-case.scad

PART = "base";

$fn = 48;
eps = 0.01;

// --- Raspberry Pi 4 (official mechanical drawing) ------------------------------
pcb = [85, 56, 1.4];
holes = [[3.5, 3.5], [61.5, 3.5], [3.5, 52.5], [61.5, 52.5]];
usb_top = 16;            // USB stack height above the board; the display rests on it

// --- Display stack (estimate: display board resting on the USB ports) ----------
lcd_board = 1.6;
lcd_module = 3.9;        // LCD + touch layer
window = [78, 52];       // active area is 73.4 x 49; extra margin for placement tolerance
window_centre = [42.7, 28];

// --- Case ---------------------------------------------------------------------
floor_t = 3;
post_h = 5;              // room under the board for keyhole screw heads
gap = 1;                 // board to inner wall
wall = 3.2;              // thick enough for an M3 self-tapping screw
base_h = 20;             // outer height of the base walls
fit = 0.25;              // sleeve clearance per side
lid_wall = 2;
lid_top = 2;
lid_skirt = 17;          // how far the lid reaches down from its top

pcb_z = floor_t + post_h;                                   // underside of the Pi
glass_z = pcb_z + pcb[2] + usb_top + lcd_board + lcd_module; // top of the glass (~31)

inner = [pcb[0] + 2 * gap, pcb[1] + 2 * gap];
outer = [inner[0] + 2 * wall, inner[1] + 2 * wall];
o = [-gap - wall, -gap - wall];                              // base outer corner in board coords
lid_in = [outer[0] + 2 * fit, outer[1] + 2 * fit];
lid_out = [lid_in[0] + 2 * lid_wall, lid_in[1] + 2 * lid_wall];
lo = [o[0] - fit - lid_wall, o[1] - fit - lid_wall];

module rbox(size, r = 2) {
    // rounded vertical edges
    linear_extrude(size[2])
        offset(r) offset(-r) square([size[0], size[1]]);
}

// --- Base -----------------------------------------------------------------------
module base() {
    difference() {
        union() {
            translate([o[0], o[1], 0]) difference() {
                rbox([outer[0], outer[1], base_h], 3);
                translate([wall, wall, floor_t]) rbox([inner[0], inner[1], base_h], 1);
            }
            for (h = holes) translate([h[0], h[1], 0]) cylinder(d = 6.5, h = pcb_z);
        }
        // M2.5 pilot holes in the posts
        for (h = holes) translate([h[0], h[1], 1.5]) cylinder(d = 2.3, h = pcb_z);

        // Bottom edge: USB-C power, 2x micro HDMI, audio (open-topped so plugs drop in)
        translate([2, o[1] - eps, pcb_z - 0.5]) cube([58, wall + 2 * eps, base_h]);
        // Right edge: USB + Ethernet, open above the board
        translate([pcb[0] - eps, 0.5, pcb_z - 0.5]) cube([wall + gap + 2 * eps, pcb[1] - 1, base_h]);
        // Left edge: microSD finger notch
        translate([o[0] - eps, 18, floor_t + 1]) cube([wall + gap + 2 * eps, 20, base_h]);

        // Keyholes: head through the big hole, then hang so the shaft sits at the top of the slot
        for (x = [20, 65]) translate([x, 24, -eps]) {
            cylinder(d = 8.5, h = floor_t + 2 * eps);
            translate([-2.1, 0, 0]) cube([4.2, 9, floor_t + 2 * eps]);
            translate([0, 9, 0]) cylinder(d = 4.2, h = floor_t + 2 * eps);
        }
        // Vents across the middle of the floor (between the keyholes)
        for (y = [8 : 6 : 48]) translate([31, y, -eps]) cube([24, 2.5, floor_t + 2 * eps]);

        // Optional lid screws: M3 pilot holes in the top and bottom walls
        for (p = [[75, o[1]], [75, pcb[1] + gap], [10, pcb[1] + gap]])
            translate([p[0], p[1] - eps, base_h - 4]) rotate([-90, 0, 0]) cylinder(d = 2.6, h = wall + 2 * eps);
    }
}

// --- Lid (modelled the right way up; printed upside down) -------------------------
module lid() {
    z0 = glass_z - (lid_skirt - lid_top);  // bottom edge of the skirt when seated
    translate([0, 0, z0]) difference() {
        translate([lo[0], lo[1], 0]) rbox([lid_out[0], lid_out[1], lid_skirt], 4);
        // inside of the sleeve
        translate([lo[0] + lid_wall, lo[1] + lid_wall, -eps]) rbox([lid_in[0], lid_in[1], lid_skirt - lid_top + eps], 3);
        // screen window, chamfered so the edges don't shade the picture
        translate([window_centre[0], window_centre[1], lid_skirt - lid_top - eps])
            linear_extrude(lid_top + 2 * eps, scale = [(window[0] + 2 * lid_top) / window[0], (window[1] + 2 * lid_top) / window[1]])
                square(window, center = true);

        // Notches matching the base openings, open at the skirt's lower edge
        translate([2, lo[1] - eps, -eps]) cube([58, lid_wall + fit + 2 * eps, lid_skirt - lid_top - 6]);
        translate([pcb[0] + gap + wall - eps, 0.5, -eps]) cube([lid_wall + fit + 2 * eps, pcb[1] - 1, lid_skirt - lid_top - 4]);
        translate([lo[0] - eps, 18, -eps]) cube([lid_wall + fit + 2 * eps, 20, 7]);

        // Vertical slots for the optional M3 screws (lid height can vary ±3 mm)
        for (p = [[75, lo[1]], [75, pcb[1] + gap + wall + fit], [10, pcb[1] + gap + wall + fit]])
            translate([p[0], p[1] - eps, base_h - 4 - z0]) rotate([-90, 0, 0])
                hull() for (dz = [-3, 3]) translate([0, -dz, 0]) cylinder(d = 3.4, h = lid_wall + fit + 2 * eps);
    }
}

// Print orientation: base on its back, lid face-down
if (PART == "base") base();
else if (PART == "lid") translate([0, 0, glass_z + lid_top]) mirror([0, 0, 1]) lid();
else if (PART == "assembly") { color("seagreen") base(); color("white", 0.8) lid(); }
