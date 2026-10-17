"""Equipment interlock on GPIO 18 (high runs the motor, low stops it) and the e-stop button on GPIO 23 to GND."""
import logging

from gpiozero import Button, Device, DigitalOutputDevice

log = logging.getLogger('interlock')


class Interlock:
    def __init__(self, loop, on_estop):
        # initial_value False: the motor stays off until the gateway decides it may run (fails safe on boot)
        self.motor = DigitalOutputDevice(18, initial_value=False)
        self.button = Button(23, pull_up=True, bounce_time=0.05)

        def pressed():   # runs on gpiozero's thread: cut the motor before anything else happens
            self.motor.off()
            log.info('E-STOP: GPIO 18 low, motor STOPPED')
            loop.call_soon_threadsafe(on_estop)

        self.button.when_pressed = pressed
        log.info('GPIO 18 interlock and GPIO 23 e-stop ready (%s)', type(Device.pin_factory).__name__)

    def apply(self, locked: bool):
        if locked == (not self.motor.value):
            return
        if locked:
            self.motor.off()
        else:
            self.motor.on()
        log.info('GPIO 18 %s: motor %s', 'low' if locked else 'high', 'STOPPED' if locked else 'running')

    @property
    def running(self) -> bool:
        return bool(self.motor.value)

    def press_estop_for_testing(self):
        """Only with GPIOZERO_PIN_FACTORY=mock: drive the e-stop pin like a real press (main wires it to SIGUSR1)."""
        pin = Device.pin_factory.pin(23)
        pin.drive_low()
        pin.drive_high()
