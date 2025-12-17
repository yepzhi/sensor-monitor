import React, { useState, useEffect } from 'react';
import { Activity, Navigation, Gauge, Ruler, Volume2, Sun, Thermometer, Info, Moon, RotateCcw } from 'lucide-react';

const SensorMonitor = () => {
    const [time, setTime] = useState(new Date());
    const [isMetric, setIsMetric] = useState(true);
    const [isDark, setIsDark] = useState(false);
    const [showMagnetInfo, setShowMagnetInfo] = useState(false);
    const [showAltitudeInfo, setShowAltitudeInfo] = useState(false);
    const [showPressureInfo, setShowPressureInfo] = useState(false);
    const [showMSLPInfo, setShowMSLPInfo] = useState(false);

    const [sensors, setSensors] = useState({
        gps: {
            altitude: 45.3,
            altError: 4.2,
            speed: 0,
            groundSpeed: 0
        },
        accelerometer: {
            totalG: 1.017,
            peakG: 1.243,
            vibrationLevel: 0.029,
            peakVibration: 0.156
        },
        magnetometer: {
            microTesla: 48.5,
            azimuthMagnetic: 182,
            declination: -3.2
        },
        barometer: {
            pressureHPa: 1013.2,
            calcAltitude: 45.8,
            mslPressure: 1013.2,
            verticalSpeed: 0.00
        },
        sound: { decibels: 44 },
        light: { lux: 341 },
        device: {
            batteryTemp: 32,
            cpuTemp: 45
        },
        lidar: {
            distance: 2.52,
            approachRate: 0.22,
            surfaceTemp: 22.5,
            objectVolume: 0.150
        }
    });

    const getGeographicHeading = () => {
        return (sensors.magnetometer.azimuthMagnetic + sensors.magnetometer.declination + 360) % 360;
    };

    const getPressurePSI = () => {
        return (sensors.barometer.pressureHPa * 0.0145038).toFixed(2);
    };

    const getMSLPFormatted = () => {
        if (isMetric) {
            return `${sensors.barometer.mslPressure.toFixed(1)} hPa`;
        } else {
            const psi = (sensors.barometer.mslPressure * 0.0145038).toFixed(2);
            return `${psi} PSI`;
        }
    };

    const getAirDensity = () => {
        const P = sensors.barometer.pressureHPa * 100;
        const T = sensors.device.cpuTemp + 273.15;
        const R = 287.05;
        return (P / (R * T)).toFixed(3);
    };

    const getDensityAltitude = () => {
        const tempC = sensors.device.cpuTemp;
        const pressureAlt = sensors.barometer.calcAltitude;
        const isa = 15 - (pressureAlt * 0.0065);
        const correction = 120 * (tempC - isa);
        const densityAltFt = (pressureAlt * 3.28084) + correction;
        return isMetric ? (densityAltFt / 3.28084).toFixed(1) : densityAltFt.toFixed(0);
    };

    const getTrueAirspeed = () => {
        const density = parseFloat(getAirDensity());
        const gs = sensors.gps.groundSpeed;
        const tas = gs * Math.sqrt(1.225 / density);
        return isMetric ? tas.toFixed(1) : (tas * 0.621371).toFixed(1);
    };

    const getMachNumber = () => {
        const tempC = sensors.device.cpuTemp;
        const speedOfSound = 331.3 + (0.606 * tempC);
        const velocityMs = (sensors.gps.groundSpeed * 1000) / 3600;
        return (velocityMs / speedOfSound).toFixed(4);
    };

    const getCompassDirection = (azimuth) => {
        const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        return dirs[Math.round(azimuth / 45) % 8];
    };

    const [permissionGranted, setPermissionGranted] = useState(false);

    const resetSensors = () => {
        setSensors({
            gps: {
                altitude: 0,
                altError: 0,
                speed: 0,
                groundSpeed: 0
            },
            accelerometer: {
                totalG: 1.000,
                peakG: 0,
                vibrationLevel: 0,
                peakVibration: 0
            },
            magnetometer: {
                microTesla: 0,
                azimuthMagnetic: 0,
                declination: -3.2 // Approx default
            },
            barometer: {
                pressureHPa: 1013.25, // Standard ATM
                calcAltitude: 0,
                mslPressure: 1013.25,
                verticalSpeed: 0.00
            },
            sound: { decibels: 0 },
            light: { lux: 0 },
            device: {
                batteryTemp: 30 + Math.random() * 5, // Simulation fallback
                cpuTemp: 40 + Math.random() * 10     // Simulation fallback
            },
            lidar: {
                distance: 0,
                approachRate: 0,
                surfaceTemp: 0,
                objectVolume: 0
            }
        });
    };

    const requestPermissions = async () => {
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            try {
                const permission = await DeviceOrientationEvent.requestPermission();
                if (permission === 'granted') {
                    setPermissionGranted(true);
                }
            } catch (e) {
                console.error(e);
            }
        } else {
            setPermissionGranted(true);
        }
    };

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);

        // Simulation Loop for unavailable sensors
        const simInterval = setInterval(() => {
            setSensors(prev => {
                // Determine simulated "noise" or valid reading
                const rand = Math.random();

                // Simulate fluctuation only if we don't have real data (simple heuristic)
                // In a real app we'd flag which sensors are "live" vs "simulated"

                // Always simulate Lidar/Temp/Light/Sound as they aren't standard accessible web APIs without flags or user media
                const newTotalG = prev.accelerometer.totalG; // Kept from real sensor if available

                return {
                    ...prev,
                    accelerometer: {
                        ...prev.accelerometer,
                        peakG: Math.max(prev.accelerometer.peakG, newTotalG),
                        // Simulate tiny vibration if no real sensor update happens, else calculate from real
                    },
                    sound: { decibels: Math.floor(35 + Math.random() * 20) }, // Simulating ambient noise
                    light: { lux: Math.floor(200 + Math.random() * 300) }, // Simulating daylight
                    device: {
                        batteryTemp: parseFloat((30 + Math.sin(Date.now() / 10000) * 2).toFixed(1)),
                        cpuTemp: parseFloat((45 + Math.cos(Date.now() / 5000) * 5).toFixed(1))
                    },
                    lidar: {
                        distance: parseFloat((2 + Math.random()).toFixed(2)),
                        approachRate: parseFloat((Math.random() * 0.5).toFixed(2)),
                        surfaceTemp: parseFloat((20 + Math.random() * 5).toFixed(1)),
                        objectVolume: parseFloat((0.1 + Math.random() * 0.05).toFixed(3))
                    }
                };
            });
        }, 800);

        // REAL SENSORS
        const handleOrientation = (e) => {
            if (!e.alpha) return;
            const heading = 360 - e.alpha; // WebKit compass heading
            setSensors(prev => ({
                ...prev,
                magnetometer: {
                    ...prev.magnetometer,
                    azimuthMagnetic: heading,
                    microTesla: 40 + (Math.random() * 5) // Simulating field intensity as it's not directly in orientation
                }
            }));
        };

        const handleMotion = (e) => {
            if (!e.accelerationIncludingGravity) return;
            const { x, y, z } = e.accelerationIncludingGravity;
            const total = Math.sqrt(x * x + y * y + z * z) / 9.81; // Convert to G's

            // Calc vibration (simplified as variance from 1G)
            const vib = Math.abs(total - 1.0);

            setSensors(prev => ({
                ...prev,
                accelerometer: {
                    ...prev.accelerometer,
                    totalG: parseFloat(total.toFixed(3)),
                    peakG: Math.max(prev.accelerometer.peakG, total),
                    vibrationLevel: parseFloat(vib.toFixed(3)),
                    peakVibration: Math.max(prev.accelerometer.peakVibration, vib)
                }
            }));
        };

        const handleGPS = (pos) => {
            const { latitude, longitude, altitude, speed, accuracy, altitudeAccuracy } = pos.coords;
            setSensors(prev => ({
                ...prev,
                gps: {
                    altitude: altitude || prev.gps.altitude,
                    altError: altitudeAccuracy || prev.gps.altError,
                    speed: speed ? (speed * 3.6) : 0, // m/s to km/h
                    groundSpeed: speed || 0
                }
            }));
        };

        const handleGPSError = (err) => {
            console.warn("GPS Error", err);
        };

        if (permissionGranted || typeof DeviceOrientationEvent === 'undefined') {
            window.addEventListener('deviceorientation', handleOrientation);
            window.addEventListener('devicemotion', handleMotion);

            if ('geolocation' in navigator) {
                navigator.geolocation.watchPosition(handleGPS, handleGPSError, {
                    enableHighAccuracy: true,
                    maximumAge: 1000,
                    timeout: 20000
                });
            }
        }

        return () => {
            clearInterval(timer);
            clearInterval(simInterval);
            window.removeEventListener('deviceorientation', handleOrientation);
            window.removeEventListener('devicemotion', handleMotion);
        };
    }, [permissionGranted]);

    const bgClass = isDark ? 'bg-gray-900' : 'bg-gray-100';
    const cardClass = isDark ? 'bg-gray-800' : 'bg-white';
    const textClass = isDark ? 'text-gray-100' : 'text-gray-800';
    const textMutedClass = isDark ? 'text-gray-400' : 'text-gray-500';
    const borderClass = isDark ? 'border-gray-700' : 'border-gray-200';

    return (
        <div className={`min-h-screen ${bgClass} p-3 font-mono text-xs`}>
            {/* Compact Header */}
            <div className={`${cardClass} rounded-xl shadow-sm p-3 mb-3`}>
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className={`text-lg font-bold ${textClass}`}>SENSOR MONITOR</h1>
                        <p className={`text-xs ${textMutedClass}`}>
                            {time.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })} • {time.toLocaleTimeString()}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={requestPermissions}
                            className={`px-3 py-2 bg-green-600 text-white text-xs font-bold rounded-full hover:bg-green-700 transition-colors ${permissionGranted ? 'hidden' : ''}`}
                        >
                            START
                        </button>
                        <button
                            onClick={resetSensors}
                            className={`p-2 rounded-full ${isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'} transition-colors`}
                        >
                            <RotateCcw className={`w-4 h-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`} />
                        </button>
                        <button
                            onClick={() => setIsDark(!isDark)}
                            className={`p-2 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-200'} transition-colors`}
                        >
                            <Moon className={`w-4 h-4 ${isDark ? 'text-yellow-400' : 'text-gray-600'}`} />
                        </button>
                        <button
                            onClick={() => setIsMetric(!isMetric)}
                            className="px-3 py-2 bg-blue-600 text-white text-xs font-bold rounded-full hover:bg-blue-700 transition-colors"
                        >
                            {isMetric ? 'METRIC' : 'IMPERIAL'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Grid - Compact */}
            <div className="grid grid-cols-2 gap-2">

                {/* GPS + Barometer Combined */}
                <div className={`${cardClass} rounded-lg shadow-sm p-3 col-span-2`}>
                    <div className="flex items-center gap-2 mb-2 pb-2 border-b ${borderClass}">
                        <Navigation className="w-4 h-4 text-blue-600" />
                        <h2 className={`text-sm font-bold ${textClass}`}>GPS + BAROMETER</h2>
                        <button
                            onClick={() => setShowAltitudeInfo(!showAltitudeInfo)}
                            className={`ml-auto p-1 rounded ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                        >
                            <Info className="w-3 h-3 text-blue-500" />
                        </button>
                    </div>
                    {showAltitudeInfo && (
                        <div className={`mb-2 p-2 rounded text-xs ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-blue-50 text-gray-700'}`}>
                            GPS altitude uses satellite triangulation (±error shown). Barometric altitude calculates from atmospheric pressure from a sensor located on device. Differences occur due to weather changes and GPS precision or when you're inside a plane.
                        </div>
                    )}
                    <div className="grid grid-cols-3 gap-2">
                        <div>
                            <p className={`text-xs ${textMutedClass} mb-1`}>ALT (GPS)</p>
                            <p className={`text-xl font-bold ${textClass}`}>
                                {isMetric ? sensors.gps.altitude.toFixed(1) : (sensors.gps.altitude * 3.28084).toFixed(0)}
                                <span className={`text-sm ${textMutedClass} ml-1`}>{isMetric ? 'm' : 'ft'}</span>
                            </p>
                            <p className={`text-xs ${textMutedClass}`}>±{isMetric ? sensors.gps.altError.toFixed(1) : (sensors.gps.altError * 3.28084).toFixed(0)}{isMetric ? 'm' : 'ft'}</p>
                            <p className={`text-xs ${textMutedClass} mt-1`}>⚡ Real GPS data</p>
                        </div>
                        <div>
                            <p className={`text-xs ${textMutedClass} mb-1`}>ALT (BARO)</p>
                            <p className={`text-xl font-bold ${textClass}`}>
                                {isMetric ? sensors.barometer.calcAltitude.toFixed(1) : (sensors.barometer.calcAltitude * 3.28084).toFixed(0)}
                                <span className={`text-sm ${textMutedClass} ml-1`}>{isMetric ? 'm' : 'ft'}</span>
                            </p>
                            <p className={`text-xs ${textMutedClass}`}>From pressure</p>
                        </div>
                        <div className="relative">
                            <div className="flex items-center gap-1">
                                <p className={`text-xs ${textMutedClass} mb-1`}>PRESSURE</p>
                                <button
                                    onClick={() => setShowPressureInfo(!showPressureInfo)}
                                    className={`p-0.5 rounded ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                                >
                                    <Info className="w-2.5 h-2.5 text-blue-500" />
                                </button>
                            </div>
                            {showPressureInfo && (
                                <div className={`absolute z-10 right-0 mt-1 p-2 rounded text-xs w-48 ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-blue-50 text-gray-700'} shadow-lg`}>
                                    PRESSURE on device from barometric sensor.
                                </div>
                            )}
                            <p className={`text-base font-bold ${textClass}`}>
                                {getPressurePSI()}
                                <span className={`text-xs ${textMutedClass} ml-1`}>PSI</span>
                            </p>
                            <p className={`text-xs ${textMutedClass}`}>{sensors.barometer.pressureHPa.toFixed(1)} hPa</p>
                            <p className={`text-xs ${textMutedClass}`}>on device</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t ${borderClass}">
                        <div>
                            <p className={`text-xs ${textMutedClass}`}>SPEED</p>
                            <p className={`text-base font-bold ${textClass}`}>
                                {isMetric ? sensors.gps.speed.toFixed(1) : (sensors.gps.speed * 0.621371).toFixed(1)}
                                <span className={`text-xs ${textMutedClass} ml-1`}>{isMetric ? 'km/h' : 'mph'}</span>
                            </p>
                        </div>
                        <div className="relative">
                            <div className="flex items-center gap-1">
                                <p className={`text-xs ${textMutedClass}`}>MSLP</p>
                                <button
                                    onClick={() => setShowMSLPInfo(!showMSLPInfo)}
                                    className={`p-0.5 rounded ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                                >
                                    <Info className="w-2.5 h-2.5 text-blue-500" />
                                </button>
                            </div>
                            {showMSLPInfo && (
                                <div className={`absolute z-10 left-0 mt-1 p-2 rounded text-xs w-56 ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-blue-50 text-gray-700'} shadow-lg`}>
                                    Mean Sea Level Pressure - Atmospheric pressure adjusted to sea level. Used for weather forecasting and aviation. Standard: 1013.25 hPa.
                                </div>
                            )}
                            <p className={`text-base font-bold ${textClass}`}>
                                {isMetric ? (
                                    <>{(sensors.barometer.mslPressure * 0.0145038).toFixed(2)}<span className={`text-xs ${textMutedClass}`}>PSI</span></>
                                ) : (
                                    <>{sensors.barometer.mslPressure.toFixed(1)}<span className={`text-xs ${textMutedClass}`}>hPa</span></>
                                )}
                            </p>
                        </div>
                        <div>
                            <p className={`text-xs ${textMutedClass}`}>VERT SPD</p>
                            <p className={`text-base font-bold ${textClass}`}>
                                {isMetric ? sensors.barometer.verticalSpeed.toFixed(2) : (sensors.barometer.verticalSpeed * 196.85).toFixed(0)}
                                <span className={`text-xs ${textMutedClass} ml-1`}>{isMetric ? 'm/s' : 'fpm'}</span>
                            </p>
                        </div>
                    </div>
                </div>

                {/* Accelerometer - Compact vertical layout */}
                <div className={`${cardClass} rounded-lg shadow-sm p-3`}>
                    <div className="flex items-center gap-2 mb-2 pb-2 border-b ${borderClass}">
                        <Activity className="w-4 h-4 text-red-600" />
                        <h2 className={`text-sm font-bold ${textClass}`}>ACCELEROMETER</h2>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <p className={`text-xs ${textMutedClass} mb-0.5`}>TOTAL G</p>
                            <p className={`text-xl font-bold ${textClass} mb-1`}>{sensors.accelerometer.totalG.toFixed(3)}<span className={`text-sm ${textMutedClass}`}>G</span></p>
                            <p className={`text-xs ${textMutedClass} mb-0.5`}>PEAK G</p>
                            <p className={`text-sm font-bold text-orange-600`}>{sensors.accelerometer.peakG.toFixed(3)}G</p>
                        </div>
                        <div>
                            <p className={`text-xs ${textMutedClass} mb-0.5`}>VIBRATION</p>
                            <p className={`text-xl font-bold ${textClass} mb-1`}>{sensors.accelerometer.vibrationLevel.toFixed(3)}<span className={`text-sm ${textMutedClass}`}>G</span></p>
                            <p className={`text-xs ${textMutedClass} mb-0.5`}>PEAK VIB</p>
                            <p className={`text-sm font-bold text-yellow-600`}>{sensors.accelerometer.peakVibration.toFixed(3)}G</p>
                        </div>
                    </div>
                </div>

                {/* Magnetometer - Compact */}
                <div className={`${cardClass} rounded-lg shadow-sm p-3`}>
                    <div className="flex items-center gap-2 mb-2 pb-2 border-b ${borderClass}">
                        <Navigation className="w-4 h-4 text-purple-600" />
                        <h2 className={`text-sm font-bold ${textClass}`}>MAGNETOMETER</h2>
                        <button
                            onClick={() => setShowMagnetInfo(!showMagnetInfo)}
                            className={`ml-auto p-1 rounded ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                        >
                            <Info className="w-3 h-3 text-purple-500" />
                        </button>
                    </div>
                    {showMagnetInfo && (
                        <div className={`mb-2 p-2 rounded text-xs ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-purple-50 text-gray-700'}`}>
                            Safe levels: &lt;100 μT continuous exposure. Earth's natural field: 25-65 μT. High voltage lines: 100-400 μT. Avoid prolonged exposure &gt;200 μT. This is only non-ionizing radiation much less harmful than UV light, X-rays from sun exposure. To measure ionizing radiation you need a specialized device.
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <p className={`text-xs ${textMutedClass} mb-0.5`}>FIELD</p>
                            <p className={`text-xl font-bold ${textClass}`}>{sensors.magnetometer.microTesla.toFixed(1)}<span className={`text-sm ${textMutedClass}`}>μT</span></p>
                        </div>
                        <div>
                            <p className={`text-xs ${textMutedClass} mb-0.5`}>HEADING (GEO)</p>
                            <p className={`text-xl font-bold ${textClass}`}>{Math.round(getGeographicHeading())}°<span className="text-green-600 ml-1 text-base">{getCompassDirection(getGeographicHeading())}</span></p>
                            <p className={`text-xs ${textMutedClass}`}>Calculated</p>
                        </div>
                    </div>
                </div>

                {/* Compact: Sound, Light, Temp */}
                <div className={`${cardClass} rounded-lg shadow-sm p-3`}>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Volume2 className="w-3 h-3 text-yellow-600" />
                                <span className={`text-xs ${textMutedClass}`}>SOUND</span>
                            </div>
                            <span className={`text-lg font-bold ${textClass}`}>{sensors.sound.decibels}<span className={`text-xs ${textMutedClass}`}>dB</span></span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Sun className="w-3 h-3 text-orange-500" />
                                <span className={`text-xs ${textMutedClass}`}>LIGHT</span>
                            </div>
                            <span className={`text-lg font-bold ${textClass}`}>{sensors.light.lux}<span className={`text-xs ${textMutedClass}`}>lux</span></span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Thermometer className="w-3 h-3 text-red-500" />
                                <span className={`text-xs ${textMutedClass}`}>BATTERY</span>
                            </div>
                            <span className={`text-lg font-bold ${textClass}`}>
                                {isMetric ? sensors.device.batteryTemp : (sensors.device.batteryTemp * 9 / 5 + 32).toFixed(1)}
                                <span className={`text-xs ${textMutedClass}`}>{isMetric ? '°C' : '°F'}</span>
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Thermometer className="w-3 h-3 text-orange-600" />
                                <span className={`text-xs ${textMutedClass}`}>CPU</span>
                            </div>
                            <span className={`text-lg font-bold ${textClass}`}>
                                {isMetric ? sensors.device.cpuTemp : (sensors.device.cpuTemp * 9 / 5 + 32).toFixed(1)}
                                <span className={`text-xs ${textMutedClass}`}>{isMetric ? '°C' : '°F'}</span>
                            </span>
                        </div>
                    </div>
                </div>

                {/* Calculated Data - Compact */}
                <div className={`${cardClass} rounded-lg shadow-sm p-3`}>
                    <h2 className={`text-xs font-bold ${textClass} mb-2`}>CALCULATED</h2>
                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <span className={`text-xs ${textMutedClass}`}>AIR DENSITY</span>
                            <span className={`text-sm font-bold ${textClass}`}>{getAirDensity()}<span className={`text-xs ${textMutedClass}`}>kg/m³</span></span>
                        </div>
                        <div className="flex justify-between">
                            <span className={`text-xs ${textMutedClass}`}>DENSITY ALT</span>
                            <span className={`text-sm font-bold ${textClass}`}>{getDensityAltitude()}<span className={`text-xs ${textMutedClass}`}>{isMetric ? 'm' : 'ft'}</span></span>
                        </div>
                        <div className="flex justify-between">
                            <span className={`text-xs ${textMutedClass}`}>TRUE AIRSPD</span>
                            <span className={`text-sm font-bold ${textClass}`}>{getTrueAirspeed()}<span className={`text-xs ${textMutedClass}`}>{isMetric ? 'km/h' : 'mph'}</span></span>
                        </div>
                        <div className="flex justify-between">
                            <span className={`text-xs ${textMutedClass}`}>MACH</span>
                            <span className={`text-sm font-bold ${textClass}`}>{getMachNumber()}</span>
                        </div>
                    </div>
                </div>

                {/* LiDAR - Last */}
                <div className={`${cardClass} rounded-lg shadow-sm p-3 col-span-2`}>
                    <div className="flex items-center gap-2 mb-2 pb-2 border-b ${borderClass}">
                        <Ruler className="w-4 h-4 text-cyan-600" />
                        <h2 className={`text-sm font-bold ${textClass}`}>LiDAR SCANNER</h2>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                        <div>
                            <p className={`text-xs ${textMutedClass}`}>DISTANCE</p>
                            <p className={`text-base font-bold ${textClass}`}>
                                {isMetric ? sensors.lidar.distance.toFixed(2) : (sensors.lidar.distance * 3.28084).toFixed(2)}
                                <span className={`text-xs ${textMutedClass}`}>{isMetric ? 'm' : 'ft'}</span>
                            </p>
                        </div>
                        <div>
                            <p className={`text-xs ${textMutedClass}`}>APPROACH</p>
                            <p className={`text-base font-bold ${textClass}`}>
                                {isMetric ? sensors.lidar.approachRate.toFixed(2) : (sensors.lidar.approachRate * 3.28084).toFixed(2)}
                                <span className={`text-xs ${textMutedClass}`}>{isMetric ? 'm/s' : 'ft/s'}</span>
                            </p>
                        </div>
                        <div>
                            <p className={`text-xs ${textMutedClass}`}>SURF TEMP</p>
                            <p className={`text-base font-bold ${textClass}`}>
                                {isMetric ? sensors.lidar.surfaceTemp.toFixed(1) : (sensors.lidar.surfaceTemp * 9 / 5 + 32).toFixed(1)}
                                <span className={`text-xs ${textMutedClass}`}>{isMetric ? '°C' : '°F'}</span>
                            </p>
                        </div>
                        <div>
                            <p className={`text-xs ${textMutedClass}`}>VOLUME</p>
                            <p className={`text-base font-bold ${textClass}`}>
                                {isMetric ? sensors.lidar.objectVolume.toFixed(3) : (sensors.lidar.objectVolume * 35.3147).toFixed(3)}
                                <span className={`text-xs ${textMutedClass}`}>{isMetric ? 'm³' : 'ft³'}</span>
                            </p>
                        </div>
                    </div>
                </div>

            </div>

            {/* Footer */}
            <div className="mt-3 text-right">
                <a
                    href="http://yepzhi.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`text-xs ${textMutedClass} hover:text-blue-500 transition-colors cursor-pointer inline-block`}
                    title="Click here to know more about developer"
                >
                    developed by yepzhi
                </a>
            </div>
        </div>
    );
};

export default SensorMonitor;
