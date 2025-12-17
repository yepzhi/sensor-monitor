import React, { useState, useEffect } from 'react';
import { Activity, Navigation, RotateCcw, Info, Moon, MapPin, Gauge, Thermometer } from 'lucide-react';

const SensorMonitor = () => {
    const [time, setTime] = useState(new Date());
    const [isMetric, setIsMetric] = useState(true);
    const [isDark, setIsDark] = useState(false);
    const [permissionGranted, setPermissionGranted] = useState(false);
    const [showInfo, setShowInfo] = useState(null);

    const [sensors, setSensors] = useState({
        gps: {
            latitude: null,
            longitude: null,
            altitude: 0,
            accuracy: null,
            speed: 0,
            heading: null
        },
        accelerometer: {
            x: 0,
            y: 0,
            z: 0,
            totalG: 0,
            peakG: 0
        },
        magnetometer: {
            heading: 0,
            accuracy: 0
        },
        available: {
            gps: false,
            motion: false,
            orientation: false
        },
        // Derived/Simulated for Calculations
        barometer: {
            pressureHPa: 1013.25,
            verticalSpeed: 0
        },
        device: {
            cpuTemp: 40 // Estimated under load
        }
    });

    // Helper: Calculate Standard Pressure at Altitude (ISA Model)
    // P = P0 * (1 - 2.25577e-5 * h)^5.25588 (h in meters)
    const calculatePressureFromAlt = (altMeters) => {
        if (!altMeters) return 1013.25;
        const p0 = 1013.25;
        return p0 * Math.pow((1 - 2.25577e-5 * altMeters), 5.25588);
    };

    const getPressurePSI = () => {
        return (sensors.barometer.pressureHPa * 0.0145038).toFixed(2);
    };

    const getAirDensity = () => {
        const P = sensors.barometer.pressureHPa * 100; // Pascals
        const T = sensors.device.cpuTemp + 273.15; // Kelvin (using est temp)
        const R = 287.05;
        return (P / (R * T)).toFixed(3);
    };

    const getDensityAltitude = () => {
        const pressureAlt = sensors.gps.altitude * 3.28084; // ft
        const tempC = sensors.device.cpuTemp;
        const isa = 15 - (pressureAlt * 0.0019812); // Standard Temp at alt
        // Simplified Density Alt
        const da = pressureAlt + (118.6 * (tempC - isa));
        return isMetric ? (da / 3.28084).toFixed(0) : da.toFixed(0);
    };

    const getCompassDirection = (deg) => {
        const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        return dirs[Math.round(deg / 45) % 8];
    };

    const toggleInfo = (id) => setShowInfo(showInfo === id ? null : id);

    const resetSensors = () => {
        setSensors(prev => ({
            ...prev,
            accelerometer: { ...prev.accelerometer, peakG: 0 }
        }));
    };

    const requestPermissions = async () => {
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            try {
                const permission = await DeviceOrientationEvent.requestPermission();
                if (permission === 'granted') setPermissionGranted(true);
            } catch (e) {
                alert(e.message);
            }
        } else {
            setPermissionGranted(true);
        }
    };

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);

        const handleOrientation = (e) => {
            let heading = e.webkitCompassHeading || (e.alpha ? 360 - e.alpha : 0);
            setSensors(prev => ({
                ...prev,
                magnetometer: { heading, accuracy: e.webkitCompassAccuracy || 0 },
                available: { ...prev.available, orientation: true }
            }));
        };

        const handleMotion = (e) => {
            const acc = e.accelerationIncludingGravity;
            if (!acc) return;
            const x = acc.x || 0, y = acc.y || 0, z = acc.z || 0;
            const total = Math.sqrt(x * x + y * y + z * z) / 9.81;
            setSensors(prev => ({
                ...prev,
                accelerometer: {
                    x, y, z, totalG: total,
                    peakG: Math.max(prev.accelerometer.peakG, total)
                },
                available: { ...prev.available, motion: true }
            }));
        };

        const handleGPS = (pos) => {
            const { latitude, longitude, altitude, accuracy, speed, heading } = pos.coords;
            const alt = altitude || 0;
            const press = calculatePressureFromAlt(alt);

            setSensors(prev => ({
                ...prev,
                gps: {
                    latitude, longitude, altitude: alt, accuracy, speed: speed || 0, heading
                },
                barometer: {
                    ...prev.barometer,
                    pressureHPa: press
                },
                available: { ...prev.available, gps: true }
            }));
        };

        if (permissionGranted || typeof DeviceOrientationEvent === 'undefined') {
            window.addEventListener('deviceorientation', handleOrientation);
            window.addEventListener('devicemotion', handleMotion);
        }

        let watchId = null;
        if ('geolocation' in navigator) {
            watchId = navigator.geolocation.watchPosition(handleGPS, console.warn, {
                enableHighAccuracy: true, maximumAge: 0, timeout: 5000
            });
        }

        return () => {
            clearInterval(timer);
            window.removeEventListener('deviceorientation', handleOrientation);
            window.removeEventListener('devicemotion', handleMotion);
            if (watchId) navigator.geolocation.clearWatch(watchId);
        };
    }, [permissionGranted]);

    const bgClass = isDark ? 'bg-gray-900' : 'bg-gray-100';
    const cardClass = isDark ? 'bg-gray-800' : 'bg-white';
    const textClass = isDark ? 'text-gray-100' : 'text-gray-800';
    const textMutedClass = isDark ? 'text-gray-400' : 'text-gray-500';
    const borderClass = isDark ? 'border-gray-700' : 'border-gray-200';

    return (
        <div className={`min-h-screen ${bgClass} p-3 font-mono text-xs transition-colors duration-300`}>
            {/* Header */}
            <div className={`${cardClass} rounded-xl shadow-sm p-3 mb-3 border ${borderClass}`}>
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className={`text-lg font-bold ${textClass} tracking-tight`}>SENSOR MONITOR</h1>
                        <p className={`text-xs ${textMutedClass}`}>REAL-TIME + DERIVED DATA</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={requestPermissions} className={`px-3 py-2 bg-green-600 text-white font-bold rounded-full hover:bg-green-700 ${permissionGranted ? 'hidden' : ''}`}>START</button>
                        <button onClick={resetSensors} className={`p-2 rounded-full ${isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'}`} title="Reset Peaks"><RotateCcw className={`w-4 h-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`} /></button>
                        <button onClick={() => setIsDark(!isDark)} className={`p-2 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}><Moon className={`w-4 h-4 ${isDark ? 'text-yellow-400' : 'text-gray-600'}`} /></button>
                        <button onClick={() => setIsMetric(!isMetric)} className="px-3 py-2 bg-blue-600 text-white font-bold rounded-full hover:bg-blue-700">{isMetric ? 'METRIC' : 'IMPERIAL'}</button>
                    </div>
                </div>
            </div>

            <div className="space-y-3">

                {/* 1. ACCELEROMETER (Top as it's most responsive) */}
                <div className={`${cardClass} rounded-lg shadow-sm p-4 border ${borderClass}`}>
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-2">
                            <Activity className="w-5 h-5 text-red-500" />
                            <h2 className={`font-bold ${textClass}`}>ACCELEROMETER</h2>
                        </div>
                        {!sensors.available.motion && <span className="text-xs text-red-500 font-bold animate-pulse">WAITING...</span>}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className={`text-center p-2 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                            <p className={`text-xs ${textMutedClass} mb-1`}>CURRENT</p>
                            <p className={`text-3xl font-black ${textClass}`}>{sensors.accelerometer.totalG.toFixed(2)}<span className="text-sm ml-1 font-normal text-gray-500">G</span></p>
                        </div>
                        <div className={`text-center p-2 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                            <p className={`text-xs ${textMutedClass} mb-1`}>PEAK</p>
                            <p className="text-3xl font-black text-red-500">{sensors.accelerometer.peakG.toFixed(2)}<span className="text-sm ml-1 font-normal text-gray-500">G</span></p>
                        </div>
                    </div>
                    <div className="mt-2 text-center text-[10px] text-gray-400">
                        X: {sensors.accelerometer.x.toFixed(2)} Y: {sensors.accelerometer.y.toFixed(2)} Z: {sensors.accelerometer.z.toFixed(2)}
                    </div>
                </div>

                {/* 2. GPS (Redesigned as requested) */}
                <div className={`${cardClass} rounded-lg shadow-sm p-4 border ${borderClass}`}>
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-2">
                            <MapPin className="w-5 h-5 text-blue-500" />
                            <h2 className={`font-bold ${textClass}`}>GPS</h2>
                        </div>
                        {!sensors.available.gps && <span className="text-xs text-orange-500 font-bold animate-pulse">LOCATING...</span>}
                    </div>

                    {/* Big Bold Stats */}
                    <div className="grid grid-cols-3 gap-2 text-center mb-4">
                        <div>
                            <p className={`text-xs ${textMutedClass} mb-1`}>SPEED</p>
                            <p className={`text-2xl font-black ${textClass}`}>
                                {sensors.gps.speed ? (isMetric ? (sensors.gps.speed * 3.6).toFixed(1) : (sensors.gps.speed * 2.23694).toFixed(1)) : '0.0'}
                            </p>
                            <span className="text-[10px] text-gray-400">{isMetric ? 'km/h' : 'mph'}</span>
                        </div>
                        <div>
                            <p className={`text-xs ${textMutedClass} mb-1`}>ALTITUDE</p>
                            <p className={`text-2xl font-black ${textClass}`}>
                                {sensors.gps.altitude ? (isMetric ? sensors.gps.altitude.toFixed(0) : (sensors.gps.altitude * 3.28084).toFixed(0)) : '0'}
                            </p>
                            <span className="text-[10px] text-gray-400">{isMetric ? 'm' : 'ft'}</span>
                        </div>
                        <div>
                            <p className={`text-xs ${textMutedClass} mb-1`}>ACCURACY</p>
                            <p className={`text-2xl font-black ${textClass}`}>
                                {sensors.gps.accuracy ? (isMetric ? sensors.gps.accuracy.toFixed(0) : (sensors.gps.accuracy * 3.28084).toFixed(0)) : '-'}
                            </p>
                            <span className="text-[10px] text-gray-400">±{isMetric ? 'm' : 'ft'}</span>
                        </div>
                    </div>

                    {/* Gray Lat/Long below */}
                    <div className={`p-2 rounded ${isDark ? 'bg-gray-900 bg-opacity-50' : 'bg-gray-50'} text-center`}>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-[10px] text-gray-400">LATITUDE</p>
                                <p className={`font-mono text-gray-500 font-bold`}>{sensors.gps.latitude ? sensors.gps.latitude.toFixed(6) : 'Wait for GPS...'}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-400">LONGITUDE</p>
                                <p className={`font-mono text-gray-500 font-bold`}>{sensors.gps.longitude ? sensors.gps.longitude.toFixed(6) : 'Wait for GPS...'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. COMPASS (Moved below GPS) */}
                <div className={`${cardClass} rounded-lg shadow-sm p-4 border ${borderClass}`}>
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-2">
                            <Navigation className="w-5 h-5 text-purple-500" />
                            <h2 className={`font-bold ${textClass}`}>COMPASS</h2>
                        </div>
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className={`text-4xl font-black ${textClass}`}>
                                {Math.round(sensors.magnetometer.heading)}°
                            </p>
                            <p className={`text-lg font-bold text-purple-500 mt-1`}>
                                {getCompassDirection(sensors.magnetometer.heading)}
                            </p>
                        </div>
                        <div className="relative w-16 h-16 border-2 border-gray-300 dark:border-gray-600 rounded-full flex items-center justify-center">
                            <div
                                className="absolute w-1 h-8 bg-purple-500 top-1/2 left-1/2 origin-bottom transform -translate-x-1/2 -translate-y-full rounded-full transition-transform duration-200"
                                style={{ transform: `translateX(-50%) translateY(-100%) rotate(${sensors.magnetometer.heading}deg)` }}
                            ></div>
                        </div>
                    </div>
                </div>

                {/* 4. ENVIRONMENT (Calculated/Baro logic restored) */}
                <div className={`${cardClass} rounded-lg shadow-sm p-4 border ${borderClass}`}>
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100 dark:border-gray-700">
                        <Gauge className="w-5 h-5 text-cyan-500" />
                        <h2 className={`font-bold ${textClass}`}>ENVIRONMENT (DERIVED)</h2>
                        <span className="text-[10px] text-gray-400 ml-auto border border-gray-500 px-1 rounded">CALCULATED from GPS</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                        <div className={`p-2 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                            <p className={`text-xs ${textMutedClass} mb-1`}>PRESSURE (ISA)</p>
                            <p className={`text-lg font-bold ${textClass}`}>
                                {getPressurePSI()} <span className="text-xs font-normal">PSI</span>
                            </p>
                            <p className={`text-xs ${textMutedClass}`}>{sensors.barometer.pressureHPa.toFixed(0)} hPa</p>
                        </div>
                        <div className={`p-2 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                            <p className={`text-xs ${textMutedClass} mb-1`}>AIR DENSITY</p>
                            <p className={`text-lg font-bold ${textClass}`}>
                                {getAirDensity()} <span className="text-xs font-normal">kg/m³</span>
                            </p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-center bg-opacity-50 p-2 rounded bg-gray-50 dark:bg-gray-900">
                            <span className={`text-xs ${textMutedClass}`}>DENSITY ALTITUDE</span>
                            <span className={`text-sm font-bold ${textClass}`}>{getDensityAltitude()} {isMetric ? 'm' : 'ft'}</span>
                        </div>
                    </div>
                </div>

            </div>

            <div className="mt-4 text-center">
                <a href="http://yepzhi.com" target="_blank" rel="noreferrer" className="text-[10px] text-gray-400 hover:text-blue-500">developed by yepzhi</a>
            </div>
        </div>
    );
};

export default SensorMonitor;
