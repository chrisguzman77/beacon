# Serial protocols

Pod (RP2040-Zero) to Pi, USB CDC, 115200 baud, one line every 100 ms:
P:1,D:182,S:41,M:12,T:33.1,H:78,W:0,TILT:0
  P presence 0/1, D detection distance cm, S still energy 0..100, M moving energy 0..100,
  T temperature C, H humidity %, W water level 0..100, TILT 0 upright 1 tipped
Immediate lines:
FLASH:<microsecond timestamp>      a light spike on the photoresistor
IR:<key>                           remote key, 0..9, OK, UP, DOWN, LEFT, RIGHT

Pi to UNO, USB, 9600 baud (a byte takes longer than the LED strip update's ~1 ms pause, so none is lost), newline terminated:
STOPWORK:<seconds>                  start or restart countdown, strobe red, 4 digit display counts down
CLEAR                               end stop work, green, display blank (the gateway then sends the status LCD line)
INDEX:<0..10>                       servo needle and color band
LCD:<line1>|<line2>                 write the beacon LCD (16 chars per line, longer is cut)
MUSTER:<n>                          crew count (0..9, 9 means 9 or more); this build has no crew digit, the UNO answers OK and shows nothing, the count is on the dashboard and the LCD status line
REST:<seconds>                      rest break countdown

UNO to Pi:
COUNT:<seconds>                     once per second while a countdown runs
OK                                  after any command

Beacon LCD lines the gateway sends (the LCD1602 on the beacon head is the beacon's text display):
LCD:ALL CLEAR  IDX 3|CREW 2  HI 92F            status, normal operation
LCD:STOP WORK  29:53|LIGHTNING 8 MI            stop work with reason and time
LCD:ZONE CLEAR|2 IN  0 NOT OUT                 zone clear during a stop work, held 5 s
LCD:LOCKED OUT|NEEDS SUPERVISOR                countdown done, awaiting PIN
LCD:ENTER PIN|**                               PIN entry, one * per digit typed
LCD:WRONG PIN|TRY AGAIN                        held 3 s, then back to awaiting PIN
LCD:RELEASED BY|SMITH 14:32                    after the PIN or a dashboard clear, held 10 s, name cut to 10 chars
LCD:E-STOP PRESSED|PIN TO RESET
LCD:HEAT REST  12:00|HEAT INDEX 116F           rest break with time
LCD:STANDING WATER|LOW POINT 35%
LCD:BEACON TIPPED|SENSORS UNSAFE
LCD:BEACON OFFLINE|LOCAL RULES ON
LCD:CREW 3 IN|ON SITE 4                        remote check in or out (CREW 3 OUT), held 3 s
LCD:BRIEFING READY|UP EN  DOWN ES              when a BRIEFING arrives, held 10 s
While a STOPWORK or REST countdown runs, the UNO rewrites the last 5 characters of line 1 with MM:SS every second, so the LCD and the 4 digit display always agree. Held lines return to the previous screen when their time is up; the gateway does that by resending it.

IR remote keys (the pod sends IR:<key>, the gateway decides what it means):
1..9      toggle crew number N in or out, sent up as checkin via remote, speaker confirms, LCD shows CREW N IN or OUT for 3 s
OK        start PIN entry (LCD ENTER PIN), then 0..9 are PIN digits, OK again submits
LEFT      cancel PIN entry; PIN entry also cancels itself after 10 s idle
UP        play the stored briefing in English
DOWN      play the stored briefing in Spanish
RIGHT     speak the current status line
0         only used as a PIN digit

Pi GPIO: 18 = L293D EN1 (high runs the motor, low is the interlock), 23 = e-stop button to GND with pull up.
