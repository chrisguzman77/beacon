// Beacon control box on the UNO R3 (contracts/serial.md, hardware guide 3.2 to 3.8).
// The Pi sends one command per line. The UNO answers OK to each, and COUNT:<n> once a second while a countdown runs.
// Nothing here blocks: the serial line is read a byte at a time and the five digits are lit one per 2 ms pass.
#include <LiquidCrystal.h>
#include <Servo.h>

const bool COMMON_ANODE = false;       // both 7 segment displays: false for 3461AS + 5161AS, true for 3461BS + 5161BS
const bool LED_COMMON_ANODE = false;   // the RGB LED: the kit's is common cathode (long leg to GND)
const int NEEDLE_MIN = 10, NEEDLE_MAX = 170;   // servo angles for index 0 and 10 (hardware guide 7.5)

LiquidCrystal lcd(12, 11, 5, 4, 3, 2);
Servo needle;
const int DS = 8, STCP = 9, SHCP = 10, RED = 6, GREEN = 7, BLUE = 13, SERVO_PIN = A5;
const int digitPins[5] = {A1, A2, A3, A4, A0};   // the 4 digit countdown, then the 1 digit crew count
const byte seg[10] = {0x3F, 0x06, 0x5B, 0x4F, 0x66, 0x6D, 0x7D, 0x07, 0x7F, 0x6F};

enum Kind { NONE, STOPWORK, REST };
Kind kind = NONE;
long remaining = 0;          // seconds left on the running countdown
bool locked = false;         // the stop work clock ran out: solid red until CLEAR or a new STOPWORK
int hazardIndex = -1;        // -1 until the Pi sends INDEX
int muster = 0;
char line1[17] = "";         // LCD line 1 as shown, padded to 16, for the MM:SS rewrite
char buf[64];
byte len = 0;
unsigned long lastTick = 0, lastStrobe = 0, lastDigit = 0, needleOffAt = 0;
bool strobeOn = false, needleOn = false;
byte slot = 0;

void color(bool r, bool g, bool b) {
  digitalWrite(RED, r != LED_COMMON_ANODE);
  digitalWrite(GREEN, g != LED_COMMON_ANODE);
  digitalWrite(BLUE, b != LED_COMMON_ANODE);
}

void showColor() {           // the steady color; the stop work strobe runs in loop()
  if (kind == STOPWORK) return;
  if (locked) color(1, 0, 0);
  else if (kind == REST) color(1, 1, 0);
  else if (hazardIndex >= 7) color(1, 0, 0);   // the index band: under 4 green, under 7 yellow, else red
  else if (hazardIndex >= 4) color(1, 1, 0);
  else color(0, 1, 0);
}

void showSlot(byte d) {      // light one of the five digits; the eye blends them
  byte p = 0;
  if (d == 4) p = seg[muster];
  else if (kind != NONE) {
    long m = min(remaining / 60, 99L), s = remaining % 60;
    byte n[4] = {byte(m / 10), byte(m % 10), byte(s / 10), byte(s % 10)};
    p = seg[n[d]] | (d == 1 ? 0x80 : 0);   // the decimal point after the minutes reads as MM.SS
  }
  for (int i = 0; i < 5; i++) digitalWrite(digitPins[i], COMMON_ANODE ? LOW : HIGH);   // all off while shifting
  digitalWrite(STCP, LOW);
  shiftOut(DS, SHCP, MSBFIRST, COMMON_ANODE ? byte(~p) : p);
  digitalWrite(STCP, HIGH);
  if (p) digitalWrite(digitPins[d], COMMON_ANODE ? HIGH : LOW);
}

bool hasClock() {            // line 1 ends in MM:SS, like "STOP WORK  29:53" and "HEAT REST  12:00"
  return isDigit(line1[11]) && isDigit(line1[12]) && line1[13] == ':' && isDigit(line1[14]) && isDigit(line1[15]);
}

void setClock() {            // MM:SS from the UNO's own count, so the LCD and the 4 digit display always agree
  long m = min(remaining / 60, 99L), s = remaining % 60;
  line1[11] = '0' + m / 10; line1[12] = '0' + m % 10; line1[14] = '0' + s / 10; line1[15] = '0' + s % 10;
}

void pad(char *dst, const char *src, int n) {   // first n chars of src, then spaces to 16, so no lcd.clear() flicker
  int i = 0;
  for (; i < 16 && i < n && src[i]; i++) dst[i] = src[i];
  for (; i < 16; i++) dst[i] = ' ';
  dst[16] = 0;
}

void showLines(const char *text) {   // "<line1>|<line2>"
  const char *bar = strchr(text, '|');
  char line2[17];
  pad(line1, text, bar ? bar - text : 16);
  pad(line2, bar ? bar + 1 : "", 16);
  if (kind != NONE && hasClock()) setClock();
  lcd.setCursor(0, 0); lcd.print(line1);
  lcd.setCursor(0, 1); lcd.print(line2);
}

void startCountdown(Kind k, long secs) {
  kind = k;
  remaining = max(secs, 1L);
  lastTick = millis();
  if (k == STOPWORK) locked = false;
  if (hasClock()) { setClock(); lcd.setCursor(11, 0); lcd.print(line1 + 11); }
}

void moveNeedle(int ix) {
  hazardIndex = ix;
  needle.attach(SERVO_PIN);
  needle.write(map(ix, 0, 10, NEEDLE_MIN, NEEDLE_MAX));
  needleOn = true;
  needleOffAt = millis() + 700;   // detach once it has arrived, so the SG90 does not hum or jitter
}

void handle(const char *s) {
  if (!strncmp(s, "STOPWORK:", 9)) startCountdown(STOPWORK, atol(s + 9));
  else if (!strncmp(s, "REST:", 5)) startCountdown(REST, atol(s + 5));
  else if (!strcmp(s, "CLEAR")) { kind = NONE; locked = false; }
  else if (!strncmp(s, "INDEX:", 6)) moveNeedle(constrain(atoi(s + 6), 0, 10));
  else if (!strncmp(s, "MUSTER:", 7)) muster = constrain(atoi(s + 7), 0, 9);
  else if (!strncmp(s, "LCD:", 4)) showLines(s + 4);
  showColor();
  Serial.println(F("OK"));
}

void setup() {
  Serial.begin(115200);
  int outs[] = {DS, STCP, SHCP, RED, GREEN, BLUE};
  for (int p : outs) pinMode(p, OUTPUT);
  for (int p : digitPins) pinMode(p, OUTPUT);
  lcd.begin(16, 2);
  showLines("BEACON STARTING|WAITING FOR PI");
  color(0, 0, 1);            // blue until the Pi's first command (the gateway resyncs everything when it opens the port)
}

void loop() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n' || c == '\r') {
      while (len && buf[len - 1] == ' ') len--;
      if (len) { buf[len] = 0; handle(buf); len = 0; }
    } else if (len < sizeof(buf) - 1) buf[len++] = c;
  }

  unsigned long now = millis();
  if (kind != NONE && now - lastTick >= 1000) {
    lastTick += 1000;
    remaining--;
    Serial.print(F("COUNT:")); Serial.println(remaining);
    if (hasClock()) { setClock(); lcd.setCursor(11, 0); lcd.print(line1 + 11); }
    if (remaining <= 0) {
      if (kind == STOPWORK) locked = true;
      kind = NONE;
      showColor();
    }
  }
  if (kind == STOPWORK && now - lastStrobe >= 250) { lastStrobe = now; strobeOn = !strobeOn; color(strobeOn, 0, 0); }
  if (needleOn && (long)(now - needleOffAt) >= 0) { needle.detach(); needleOn = false; }

  if (micros() - lastDigit >= 2000) { lastDigit = micros(); slot = (slot + 1) % 5; showSlot(slot); }
}
