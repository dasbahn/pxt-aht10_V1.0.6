//% color=#00AACC icon="\uf2c9" block="AHT10"
namespace AHT10 {
    let initialized = false

    function init() {
        pins.i2cWriteNumber(0x38, 0xE1, NumberFormat.UInt8BE)
        basic.pause(10)
        initialized = true
    }

    function readRaw(): number[] {
        if (!initialized) init()

        pins.i2cWriteNumber(0x38, 0xAC, NumberFormat.UInt8BE)
        basic.pause(80)

        let buf = pins.i2cReadBuffer(0x38, 6)
        return [buf[1], buf[2], buf[3], buf[4], buf[5]]
    }

    //% block="Temperatur (°C)"
    export function temperature(): number {
        let r = readRaw()
        let rawT = ((r[2] & 0x0F) << 16) | (r[3] << 8) | r[4]
        return (rawT * 200 / 1048576) - 50
    }

    //% block="Temperatur (°F)"
    export function temperatureF(): number {
        return temperature() * 9 / 5 + 32
    }

    //% block="Luftfeuchtigkeit (%)"
    export function humidity(): number {
        let r = readRaw()
        let rawH = (r[0] << 12) | (r[1] << 4) | (r[2] >> 4)
        return (rawH * 100) / 1048576
    }

    //% block="Taupunkt (°C)"
    export function dewPoint(): number {
        let T = temperature()
        let RH = humidity()
        let a = 17.27
        let b = 237.7
        let alpha = ((a * T) / (b + T)) + Math.log(RH / 100)
        return (b * alpha) / (a - alpha)
    }

    //% block="Heat Index (°C)"
    export function heatIndex(): number {
        let T = temperature()
        let RH = humidity()
        return -8.784695 + 1.61139411 * T + 2.338549 * RH
            - 0.14611605 * T * RH - 0.012308094 * T * T
            - 0.016424828 * RH * RH + 0.002211732 * T * T * RH
            + 0.00072546 * T * RH * RH - 0.000003582 * T * T * RH * RH
    }
}
