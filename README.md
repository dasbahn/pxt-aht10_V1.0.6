
# AHT10 Erweiterung für MakeCode (micro:bit / Calliope mini)

MakeCode‑Erweiterung für den **AHT10** Temperatur‑ und Luftfeuchtigkeitssensor über **I²C** (Standardadresse `0x38` / dezimal `56`).  
Unterstützt Messung von **Temperatur (°C/°F)** und **relativer Luftfeuchte (%)** sowie abgeleitete Größen **Taupunkt (°C)** und **Heat Index (°C)**.

---

## Installation

**Variante A – Release‑Tag (V1.1.0)**
MakeCode → **Erweiterungen** → **Erweiterung hinzufügen** → **GitHub‑URL**: https://github.com/dasbahn/pxt-aht10_V1.1.0.git

## Verdrahtung
- AHT10 VCC → 3.3V (kein 5V!)
- AHT10 GND → GND
- AHT10 SDA → P20 (SDA)
- AHT10 SCL → P19 (SCL)
- Standardadresse: 0x38

## Beispiel (JavaScript)
```ts
AHT10.initialize()
basic.forever(function () {
    const t = AHT10.temperatureC()
    const h = AHT10.humidity()
    basic.showNumber(Math.round(t))
    basic.pause(500)
    basic.showNumber(Math.round(h))
    basic.pause(500)
})
``
