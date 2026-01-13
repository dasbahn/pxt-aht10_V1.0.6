//% color=#00AACC icon="\uf2c9" block="AHT10"
namespace AHT10 {
    let initialized = false

    function init() {
        let buf = pins.createBuffer(3)
        buf[0] = 0xE1
        buf[1] = 0x08
        buf[2] = 0x00
        pins.i2cWriteBuffer(0x38, buf)
        basic.pause(40)
        initialized = true
    }

    function readRaw(): number[] {
        if (!initialized) init()

        let cmd = pins.createBuffer(3)
        cmd[0] = 0xAC
        cmd[1] = 0x33
        cmd[2] = 0x00
        pins.i2cWriteBuffer(0x38, cmd)

        basic.pause(120)

        let buf = pins.i2cReadBuffer(0x38, 6)

        // Fehlererkennung: Wenn alles 0 ist → ungültig
        if (buf[1] == 0 && buf[2] == 0 && buf[3] == 0) {
            return [0, 0, 0, 0, 0]
        }

        return [buf[1], buf[2], buf[3], buf[4], buf[5]]
    }

    //% block="Temperatur (°C)"
    export function temperature(): number {
        let r = readRaw()
        let rawT = ((r[2] & 0x0F) << 16) | (r[3] << 8) | r[4]
        return (rawT * 200 / 1048576) - 50
    }

    //% block="Luftfeuchtigkeit (%)"
    export function humidity(): number {
        let r = readRaw()
        let rawH = (r[0] << 12) | (r[1] << 4) | (r[2] >> 4)
        return (rawH * 100) / 1048576
    }
}
