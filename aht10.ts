
/**
 * AHT10-Erweiterung für MakeCode (micro:bit / Calliope mini)
 * I²C-Adresse: 0x38 (dezimal 56)
 * Init:   0xE1 0x08 0x00 (+ optional Soft-Reset 0xBA)
 * Messung: 0xAC 0x33 0x00
 * Umrechnung:
 *   Feuchte(%) = rawHum * 100 / 2^20
 *   Temp(°C)   = rawTemp * 200 / 2^20 - 50
 */

//% color="#5C9DFF" icon="\uf2c9" block="AHT10"
namespace AHT10 {
    const DEFAULT_ADDR = 0x38
    let _initialized = false
    let _address = DEFAULT_ADDR

    // ----------- Low-Level I²C -----------
    function i2cWriteBytes(addr: number, b0: number, b1: number, b2: number): void {
        const buf = pins.createBuffer(3)
        buf[0] = b0
        buf[1] = b1
        buf[2] = b2
        pins.i2cWriteBuffer(addr, buf)
    }

    function i2cRead(addr: number, len: number): Buffer {
        return pins.i2cReadBuffer(addr, len)
    }

    // ----------- Init / Reset -----------
    function initOnce(addr: number): void {
        if (_initialized && _address === addr) return
        _address = addr

        // Soft-Reset (definierter Startzustand)
        const sr = pins.createBuffer(1)
        sr[0] = 0xBA
        pins.i2cWriteBuffer(_address, sr)
        basic.pause(40)

        // Init/Calibrate
        i2cWriteBytes(_address, 0xE1, 0x08, 0x00)
        basic.pause(300)

        _initialized = true
    }

    //% blockId=aht10_soft_reset block="AHT10 Soft-Reset an Adresse %address"
    //% address.defl=0x38 address.min=0 address.max=127
    //% weight=95
    export function softReset(address: number = DEFAULT_ADDR): void {
        _address = address
        const sr = pins.createBuffer(1)
        sr[0] = 0xBA
        pins.i2cWriteBuffer(_address, sr)
        basic.pause(40)
        _initialized = false
        initOnce(_address)
    }

    // ----------- Messen & Parsen -----------
    /**
     * Löst eine Messung aus, wartet bis Busy=0, liest 6 Bytes zurück.
     * (Einige Module haben 7. Byte CRC; für die Auswertung nicht nötig.)
     */
    function measureAndRead6(addr: number): Buffer {
        // Trigger
        i2cWriteBytes(addr, 0xAC, 0x33, 0x00)
        basic.pause(120)

        // Busy-Polling (Bit7 im Status-Byte)
        for (let i = 0; i < 40; i++) {
            const buf = i2cRead(addr, 6)
            const status = buf[0]
            const busy = (status & 0x80) !== 0
            if (!busy) {
                return buf
            }
            basic.pause(12)
        }
        // Rückfall
        return i2cRead(addr, 6)
    }

    function parseRaw(buf: Buffer): { rawHum: number, rawTemp: number } {
        // Rohfeuchte: 20 Bit: buf[1], buf[2], high nibble buf[3]
        const rawHum = ((buf[1] << 12) | (buf[2] << 4) | (buf[3] >> 4)) & 0xFFFFF
        // Rohtemp: 20 Bit: low nibble buf[3], buf[4], buf[5]
        const rawTemp = (((buf[3] & 0x0F) << 16) | (buf[4] << 8) | buf[5]) & 0xFFFFF
        return { rawHum, rawTemp }
    }

    // ----------- Öffentliche API / Blöcke -----------
    //% blockId=aht10_initialize block="AHT10 initialisieren an Adresse %address"
    //% address.defl=0x38 address.min=0 address.max=127
    //% weight=100
    export function initialize(address: number = DEFAULT_ADDR): void {
        initOnce(address)
    }

    //% blockId=aht10_humidity_pct block="AHT10 Luftfeuchtigkeit in Prozent an Adresse %address"
    //% address.defl=0x38 address.min=0 address.max=127
    //% weight=90
    export function humidity(address: number = DEFAULT_ADDR): number {
        initOnce(address)

        // 1. Versuch
        let buf = measureAndRead6(address)
        let raw = parseRaw(buf).rawHum
        let hum = (raw * 100) / 1048576
        hum = Math.max(0, Math.min(100, hum))

        // 2. Versuch bei unplausiblen Werten
        if (hum <= 0 || hum > 100) {
            basic.pause(100)
            buf = measureAndRead6(address)
            raw = parseRaw(buf).rawHum
            hum = (raw * 100) / 1048576
            hum = Math.max(0, Math.min(100, hum))
        }
        return hum
    }

    //% blockId=aht10_temperature_c block="AHT10 Temperatur (°C) an Adresse %address"
    //% address.defl=0x38 address.min=0 address.max=127
    //% weight=85
    export function temperatureC(address: number = DEFAULT_ADDR): number {
        initOnce(address)

        let buf = measureAndRead6(address)
        let raw = parseRaw(buf).rawTemp
        let tempC = (raw * 200) / 1048576 - 50

        if (tempC < -40 || tempC > 85) {
            basic.pause(100)
            buf = measureAndRead6(address)
            raw = parseRaw(buf).rawTemp
            tempC = (raw * 200) / 1048576 - 50
        }
        return tempC
    }

    //% blockId=aht10_temperature_f block="AHT10 Temperatur (°F) an Adresse %address"
    //% address.defl=0x38 address.min=0 address.max=127
    //% weight=80
    export function temperatureF(address: number = DEFAULT_ADDR): number {
        const c = temperatureC(address)
        return c * 9 / 5 + 32
    }

    /**
     * Taupunkt (°C) via Magnus-Formel (Tetens)
     */
    //% blockId=aht10_dewpoint_c block="AHT10 Taupunkt (°C) an Adresse %address"
    //% address.defl=0x38 address.min=0 address.max=127
    //% weight=70
    export function dewPointC(address: number = DEFAULT_ADDR): number {
        const t = temperatureC(address)
        const h = humidity(address)
        const a = 17.62
        const b = 243.12
        const gamma = (a * t) / (b + t) + Math.log(h / 100)
        const dew = (b * gamma) / (a - gamma)
        return dew
    }

    /**
     * Heat Index (°C) auf Basis NOAA/Steadman
     */
    //% blockId=aht10_heatindex_c block="AHT10 Heat Index (°C) an Adresse %address"
    //% address.defl=0x38 address.min=0 address.max=127
    //% weight=65
    export function heatIndexC(address: number = DEFAULT_ADDR): number {
        const tC = temperatureC(address)
        const h = humidity(address)
        const tF = tC * 9 / 5 + 32

        if (tF < 80) {
            const hiF = 0.5 * (tF + 61.0 + ((tF - 68.0) * 1.2) + (h * 0.094))
            return (hiF - 32) * 5 / 9
        }

        let hiF =
            -42.379 +
            2.04901523 * tF +
            10.14333127 * h +
            -0.22475541 * tF * h +
            -0.00683783 * tF * tF +
            -0.05481717 * h * h +
            0.00122874 * tF * tF * h +
            0.00085282 * tF * h * h +
            -0.00000199 * tF * tF * h * h

        if (h < 13 && tF >= 80 && tF <= 112) {
            hiF += ((13 - h) / 4) * Math.sqrt((17 - Math.abs(tF - 95)) / 17)
        } else if (h > 85 && tF >= 80 && tF <= 87) {
            hiF += ((h - 85) / 10) * ((87 - tF) / 5)
        }

        return (hiF - 32) * 5 / 9
    }

    /**
     * Beide Werte lesen (JS-Helfer, kein Block)
     */
    //% blockHidden=true
    export function readBoth(address: number = DEFAULT_ADDR): { humidity: number, temperatureC: number } {
        initOnce(address)
        const buf = measureAndRead6(address)
        const raw = parseRaw(buf)
        const hum = Math.max(0, Math.min(100, (raw.rawHum * 100) / 1048576))
        const tempC = (raw.rawTemp * 200) / 1048576 - 50
        return { humidity: hum, temperatureC: tempC }
    }

    /**
     * Rohbytes zu Diagnosezwecken seriell ausgeben
     */
    //% blockId=aht10_dump_raw block="AHT10 Rohbytes dumpen an Adresse %address"
    //% address.defl=0x38 address.min=0 address.max=127
    //% weight=9
    export function dumpRaw(address: number = DEFAULT_ADDR): void {
        const buf = measureAndRead6(address)
        let line = "RAW(6):"
        for (let i = 0; i < buf.length; i++) {
            line += " " + buf[i]
        }
        serial.writeLine(line)

        const rawHum = ((buf[1] << 12) | (buf[2] << 4) | (buf[3] >> 4)) & 0xFFFFF
        const rawTemp = (((buf[3] & 0x0F) << 16) | (buf[4] << 8) | buf[5]) & 0xFFFFF
        const hum = Math.max(0, Math.min(100, (rawHum * 100) / 1048576))
        const tempC = (rawTemp * 200) / 1048576 - 50
        serial.writeLine("rawHum=" + rawHum + " rawTemp=" + rawTemp + " -> H=" + hum + "% T=" + tempC + "C")
    }
}
