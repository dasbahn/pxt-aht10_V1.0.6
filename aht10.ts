
/**
 * AHT10-Erweiterung für micro:bit MakeCode
 * Protokoll: I²C 0x38, Init: 0xE1 0x08 0x00, Messung: 0xAC 0x33 0x00
 * Berechnung:
 *   Feuchte(%) = rawHum * 100 / 2^20
 *   Temp(°C)   = rawTemp * 200 / 2^20 - 50
 */

//% color="#5C9DFF" icon="\uf2c9" block="AHT10"
namespace AHT10 {
    const DEFAULT_ADDR = 0x38
    let _initialized = false
    let _address = DEFAULT_ADDR

    /**
     * Interne Hilfsfunktion: Sende einen Befehl (Buffer) an die I²C-Adresse
     */
    function i2cWrite(addr: number, data: number[]): void {
        const buf = pins.createBuffer(data.length)
        for (let i = 0; i < data.length; i++) buf[i] = data[i]
        pins.i2cWriteBuffer(addr, buf)
    }

    /**
     * Interne Hilfsfunktion: Lese einen Buffer von der I²C-Adresse
     */
    function i2cRead(addr: number, len: number): Buffer {
        return pins.i2cReadBuffer(addr, len)
    }

    /**
     * Sensor initialisieren/kalibrieren (einmal pro Start ausreichend)
     */
    function initOnce(addr: number): void {
        if (_initialized && _address === addr) return
        _address = addr
        // Init/Calibrate: 0xE1 0x08 0x00
        i2cWrite(_address, [0xE1, 0x08, 0x00])
        basic.pause(300)
        _initialized = true
    }

    /**
     * Optional: Soft-Reset falls Sensor hängt
     */
    //% block="AHT10 Soft-Reset an Adresse %address"
    //% address.defl=0x38 address.min=0 address.max=127
    export function softReset(address: number = DEFAULT_ADDR): void {
        _address = address
        i2cWrite(_address, [0xBA])
        basic.pause(20)
        _initialized = false
        initOnce(_address)
    }

    /**
     * Messung starten und Daten lesen; pollt Busy-Bit bis frei oder Timeout
     */
    function read6Bytes(addr: number): Buffer {
        // Trigger measurement: 0xAC 0x33 0x00
        i2cWrite(addr, [0xAC, 0x33, 0x00])
        // typische Zeit: ~75–80 ms
        basic.pause(80)

        // bis zu ~20 Versuche, Busy-Bit prüfen
        for (let i = 0; i < 20; i++) {
            const buf = i2cRead(addr, 6)
            // Status im ersten Byte, Busy Bit = Bit 7
            const status = buf[0]
            if ((status & 0x80) === 0) {
                return buf
            }
            basic.pause(10)
        }
        // letzter Versuch zurückgeben (kann Busy sein)
        return i2cRead(addr, 6)
    }

    /**
     * Aus den 6 Bytes Rohwerte extrahieren
     */
    function parseRaw(buf: Buffer): { rawHum: number, rawTemp: number } {
        // Rohfeuchte: Bits 0..19 über buf[1]..buf[3] (hohe Nibble)
        const rawHum = ((buf[1] << 12) | (buf[2] << 4) | (buf[3] >> 4)) & 0xFFFFF
        // Rohtemp: untere 4 Bits von buf[3], dann buf[4], buf[5]
        const rawTemp = (((buf[3] & 0x0F) << 16) | (buf[4] << 8) | buf[5]) & 0xFFFFF
        return { rawHum, rawTemp }
    }

    /**
     * Initialisiert den Sensor (empfohlen im Start-Block)
     */
    //% block="AHT10 initialisieren an Adresse %address"
    //% address.defl=0x38 address.min=0 address.max=127
    //% weight=90
    export function initialize(address: number = DEFAULT_ADDR): void {
        initOnce(address)
    }

    /**
     * Liest die relative Luftfeuchtigkeit in Prozent (%)
     */
    //% block="AHT10 Luftfeuchtigkeit (%%) an Adresse %address"
    //% address.defl=0x38 address.min=0 address.max=127
    //% weight=80
    export function humidity(address: number = DEFAULT_ADDR): number {
        initOnce(address)
        const buf = read6Bytes(address)
        const raw = parseRaw(buf).rawHum
        // Umrechnung: raw / 2^20 * 100
        const hum = (raw * 100) / 1048576
        return Math.max(0, Math.min(100, hum))
    }

    /**
     * Liest die Temperatur in Grad Celsius (°C)
     */
    //% block="AHT10 Temperatur (°C) an Adresse %address"
    //% address.defl=0x38 address.min=0 address.max=127
    //% weight=70
    export function temperatureC(address: number = DEFAULT_ADDR): number {
        initOnce(address)
        const buf = read6Bytes(address)
        const raw = parseRaw(buf).rawTemp
        // Umrechnung: raw / 2^20 * 200 - 50
        const tempC = (raw * 200) / 1048576 - 50
        return tempC
    }

    /**
     * Liest die Temperatur in Grad Fahrenheit (°F)
     */
    //% block="AHT10 Temperatur (°F) an Adresse %address"
    //% address.defl=0x38 address.min=0 address.max=127
    //% weight=60
    export function temperatureF(address: number = DEFAULT_ADDR): number {
        const c = temperatureC(address)
        return c * 9 / 5 + 32
    }

    /**
     * Lese beide Werte als Tupel (nur für JavaScript)
     */
    //% blockHidden=true
    export function readBoth(address: number = DEFAULT_ADDR): { humidity: number, temperatureC: number } {
        initOnce(address)
        const buf = read6Bytes(address)
        const raw = parseRaw(buf)
        const hum = (raw.rawHum * 100) / 1048576
        const tempC = (raw.rawTemp * 200) / 1048576 - 50
        return { humidity: Math.max(0, Math.min(100, hum)), temperatureC: tempC }
    }
}
