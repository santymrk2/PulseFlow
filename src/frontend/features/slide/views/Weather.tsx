import { useEffect, useState } from "react"
import type { Weather as WeatherData } from "../../../../types/Show"
import { timeFormat } from "../../../shared/core/stores"
import { translateText } from "../../../shared/utils/language"
import { getWeather } from "../../../shared/utils/weather"
import { T } from "../../../shared/ui/helpers/T"
import { useStore } from "../../../shared/ui/hooks/useStore"
import styles from "./Weather.module.css"

export interface WeatherProps {
    data: WeatherData
}

interface WeatherTime {
    name: string
    icon?: string
    temperature: string | number
    wind_speed: string
}

function toGlobalISO(time: number | string) {
    const currentTime = new Date(time)
    return `${currentTime.getFullYear()}-${(currentTime.getMonth() + 1).toString().padStart(2, "0")}-${currentTime.getDate().toString().padStart(2, "0")}T${currentTime.getHours().toString().padStart(2, "0")}:${currentTime.getMinutes().toString().padStart(2, "0")}:${currentTime.getSeconds().toString().padStart(2, "0")}Z`
}

// (F24.18a).
export function Weather({ data }: WeatherProps) {
    const format = useStore(timeFormat)
    const [updated, setUpdated] = useState("")
    const [times, setTimes] = useState<WeatherTime[]>([])
    const size = (data.size || 100) / 100

    function getTime(time: number | string) {
        const currentTime = new Date(time)
        const twelve = format === "12"
        let h = currentTime.getHours()

        if (twelve) {
            if (h === 0) h = 12
            else if (h > 12) h -= 12
            return `${h.toString().padStart(2, "0")}:${currentTime.getMinutes().toString().padStart(2, "0")} ${currentTime.getHours() >= 12 ? "PM" : "AM"}`
        }

        return `${h.toString().padStart(2, "0")}:${currentTime.getMinutes().toString().padStart(2, "0")}`
    }

    async function updateWeather() {
        const weather = await getWeather(data)
        if (!weather) return

        setUpdated(weather.properties.meta.updated_at)
        const units = weather.properties.meta.units
        if (data.useFahrenheit) units.air_temperature = "fahrenheit"
        const u_wind_speed = " " + units.wind_speed
        const u_temp = "° " + ({ celsius: "C", fahrenheit: "F" }[units.air_temperature] || "C")

        const now = new Date()
        let timestamps: number[] = []
        if (data.longRange) {
            now.setHours(12, 0, 0, 0)
            timestamps = [now.getTime(), now.setDate(now.getDate() + 1), now.setDate(now.getDate() + 1), now.setDate(now.getDate() + 1)]
        } else {
            now.setHours(now.getHours() + 1, 0, 0, 0)
            timestamps = [now.getTime(), now.setHours(now.getHours() + 3, 0, 0, 0), now.setHours(now.getHours() + 3, 0, 0, 0), now.setHours(now.getHours() + 5, 0, 0, 0)]
        }

        setTimes(
            timestamps
                .map((a, i) => {
                    const currentTime = new Date(a)
                    const dayIndex = currentTime.getDay() === 0 ? 7 : currentTime.getDay()
                    const dayname = translateText(i < 2 ? `calendar.${i === 0 ? "today" : "tomorrow"}` : `weekday.${dayIndex}`)
                    const isoTime = toGlobalISO(a)
                    let timedata = weather.properties.timeseries.find((entry) => entry.time === isoTime)
                    if (timedata && i === 0) timedata = weather.properties.timeseries[0]
                    if (!timedata) return null

                    return {
                        name: data.longRange ? dayname : i === 0 ? translateText("calendar.now") : getTime(a),
                        icon: (timedata?.data.next_1_hours || timedata?.data.next_6_hours)?.summary.symbol_code,
                        temperature: convertTemperature(timedata.data.instant.details.air_temperature || 0, !!data.useFahrenheit) + u_temp,
                        wind_speed: timedata.data.instant.details.wind_speed + u_wind_speed
                    }
                })
                .filter(Boolean) as WeatherTime[]
        )
    }

    useEffect(() => {
        if (data) updateWeather()
    }, [data])

    return (
        <div className={styles.weather} style={{ fontSize: `${size}em` }}>
            {data.latitude && data.longitude ? (
                times.length ? (
                    <>
                        {times.map((time, i) => (
                            <div className={styles.time} key={i}>
                                <p style={{ fontSize: "0.8em" }}>{time.name}</p>
                                {time.icon ? <img src={`./assets/weather/${time.icon}.svg`} alt={time.icon} height={`${280 * size}px`} width={`${280 * size}px`} /> : null}
                                <p style={{ fontSize: "1em" }}>{time.temperature}</p>
                                <p style={{ fontSize: "0.4em" }}>{time.wind_speed}</p>
                            </div>
                        ))}
                        <p className={styles.credits}>{`Data from MET Norway${updated ? ` (Last update: ${getTime(updated)})` : ""}`}</p>
                    </>
                ) : (
                    <T id="remote.loading" />
                )
            ) : null}
        </div>
    )
}

function convertTemperature(value: number, useFahrenheit: boolean) {
    if (!useFahrenheit) return value
    return ((value * 9) / 5 + 32).toFixed(1).replace(".0", "")
}
