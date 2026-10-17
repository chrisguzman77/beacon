# Serial protocols

Pod (RP2040-Zero) to Pi, USB CDC, 115200 baud, one line every 100 ms:
P:1,D:182,S:41,M:12,T:33.1,H:78,W:0,TILT:0
  P presence 0/1, D detection distance cm, S still energy 0..100, M moving energy 0..100,
  T temperature C, H humidity %, W water level 0..100, TILT 0 upright 1 tipped
Immediate lines:
FLASH:<microsecond timestamp>      a light spike on the photoresistor
IR:<key>                           remote key, 0..9, OK, UP, DOWN, LEFT, RIGHT

Pi to UNO, USB, 115200 baud, newline terminated:
STOPWORK:<seconds>                  start or restart countdown, strobe red, LCD "LOCKED OUT"
CLEAR                               end stop work, green, LCD "RIG 1  RUNNING|BEACON LINK OK"
INDEX:<0..10>                       servo needle and color band
LCD:<line1>|<line2>                 write the equipment LCD (16 chars per line)
MUSTER:<n>                          crew count
REST:<seconds>                      rest break countdown

UNO to Pi:
COUNT:<seconds>                     once per second while a countdown runs
OK                                  after any command

Equipment LCD lines the gateway sends:
LCD:RIG 1  RUNNING|BEACON LINK OK
LCD:LOCKED OUT|LIGHTNING 8MI 27:41       (the UNO keeps the time updated)
LCD:LOCKED OUT|NEEDS SUPERVISOR
LCD:RELEASED BY <NAME>|<HH:MM MON DD>
LCD:E-STOP PRESSED|RESET AT BEACON
LCD:LOCKED OUT|HEAT REST BREAK 12:00
LCD:BEACON OFFLINE|LOCAL RULES ACTIVE

Pi GPIO: 18 = L293D EN1 (high runs the motor, low is the interlock), 23 = e-stop button to GND with pull up.
