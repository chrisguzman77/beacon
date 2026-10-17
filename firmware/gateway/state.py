"""The one state everything writes into (Appendix C). Derived values (led, interlock, LCD screen) are computed here."""
from dataclasses import dataclass, field


@dataclass
class State:
    # stop work
    stopwork: bool = False            # countdown running
    awaiting_clear: bool = False      # countdown finished, locked until PIN or dashboard clear
    strike_at: float = 0.0            # monotonic time of the strike that started or last reset the stop work
    reason: str = ''                  # LIGHTNING 8 MI
    countdown: int = 0                # from the UNO's COUNT echo
    countdown_kind: str = ''          # stopwork | rest
    estop: bool = False
    # rest break and sensors
    rest: bool = False
    heat_f: float | None = None
    heat_level: int = 0               # 0 normal, 1 warning >= 103, 2 danger >= 115
    water: bool = False
    water_pct: int = 0
    tilt: bool = False
    presence: bool = False
    zone_clear: bool = False
    pod: dict = field(default_factory=dict)
    # cloud and crew
    online: bool = False
    index: int | None = None
    index_reason: str = ''
    crew_on_site: int = 0
    crew_checked_in_today: int = 0
    briefing: dict | None = None
    pin_entry: str | None = None      # None when not entering a PIN
    lcd: list = field(default_factory=lambda: ['', ''])

    @property
    def locked(self) -> bool:
        return self.stopwork or self.awaiting_clear or self.estop

    @property
    def led(self) -> str:
        if self.stopwork:
            return 'strobe'
        if self.awaiting_clear or self.estop or self.tilt:
            return 'red'
        if self.rest or self.heat_level or self.water:
            return 'yellow'
        return 'green'

    def screen(self) -> tuple[str, str]:
        """The base LCD screen by priority (contracts/serial.md). Held screens are layered on top by uno.Lcd."""
        mmss = f'{self.countdown // 60:02d}:{self.countdown % 60:02d}'
        if self.estop:
            return 'E-STOP PRESSED', 'PIN TO RESET'
        if self.pin_entry is not None:
            return 'ENTER PIN', '*' * len(self.pin_entry)
        if self.stopwork:
            return f'STOP WORK  {mmss}', self.reason
        if self.awaiting_clear:
            return 'LOCKED OUT', 'NEEDS SUPERVISOR'
        if self.rest:
            return f'HEAT REST  {mmss}', f'HEAT INDEX {round(self.heat_f or 0)}F'
        if self.tilt:
            return 'BEACON TIPPED', 'SENSORS UNSAFE'
        if self.water:
            return 'STANDING WATER', f'LOW POINT {self.water_pct}%'
        if not self.online:
            return 'BEACON OFFLINE', 'LOCAL RULES ON'
        idx = '-' if self.index is None else self.index
        hi = '' if self.heat_f is None else f'  HI {round(self.heat_f)}F'
        return f'ALL CLEAR  IDX {idx}', f'CREW {self.crew_on_site}{hi}'

    def device(self) -> dict:
        """The "state" message body (contracts/gateway-ws.md)."""
        return {'led': self.led, 'countdown': self.countdown, 'index': self.index,
                'interlock': 'locked' if self.locked else 'running', 'presence': self.presence,
                'online': self.online, 'lcd': list(self.lcd)}


S = State()
