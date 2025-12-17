import React, { useState, useEffect } from 'react';
import { Activity, Navigation, RotateCcw, Info, Moon, MapPin } from 'lucide-react';

const SensorMonitor = () => {
    const [time, setTime] = useState(new Date());
    const [isMetric, setIsMetric] = useState(true);
    const [isDark, setIsDark] = useState(false);
    const [permissionGranted, setPermissionGranted] = useState(false);
    const [showInfo, setShowInfo] = useState(null); // 'gps', 'accel', 'mag'

    const [sensors, setSensors] = useState({
        gps: {
            latitude: null,
            longitude: null,
            altitude: null,
            accuracy: null,
            speed: null,
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
        }
    });

    const resetSensors = () => {
        setSensors(prev => ({
            ...prev,
            accelerometer: {
                ...prev.accelerometer,
                peakG: 0
            }
        }));
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
                alert("Error requesting permission: " + e.message);
            }
        } else {
            setPermissionGranted(true);
        }
    };

    const toggleInfo = (id) => {
        setShowInfo(showInfo === id ? null : id);
    };

    const getCompassDirection = (deg) => {
        const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        return dirs[Math.round(deg / 45) % 8];
    };

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);

        // Handlers
        const handleOrientation = (e) => {
            // iOS: webkitCompassHeading, Android/Others: alpha (needs absolute flag usually)
            let heading = 0;
            if (e.webkitCompassHeading) {
                heading = e.webkitCompassHeading;
            } else if (e.alpha) {
                heading = 360 - e.alpha;
            }

            setSensors(prev => ({
                ...prev,
                magnetometer: {
                    heading: heading,
                    accuracy: e.webkitCompassAccuracy || 0
                },
                available: { ...prev.available, orientation: true }
            }));
        };

        const handleMotion = (e) => {
            const acc = e.accelerationIncludingGravity;
            if (!acc) return;

            const x = acc.x || 0;
            const y = acc.y || 0;
            const z = acc.z || 0;
            const total = Math.sqrt(x * x + y * y + z * z) / 9.81;

            setSensors(prev => ({
                ...prev,
                accelerometer: {
                    x: x,
                    y: y,
                    z: z,
                    totalG: total,
                    peakG: Math.max(prev.accelerometer.peakG, total)
                },
                available: { ...prev.available, motion: true }
            }));
        };

        const handleGPS = (pos) => {
            const { latitude, longitude, altitude, accuracy, speed, heading } = pos.coords;
            setSensors(prev => ({
                ...prev,
                gps: {
                    latitude,
                    longitude,
                    altitude,
                    accuracy,
                    speed: speed || 0,
                    heading: heading
                },
                available: { ...prev.available, gps: true }
            }));
        };

        const handleGPSError = (err) => {
            console.warn("GPS Error", err);
        };

        // Hooks
        if (permissionGranted || typeof DeviceOrientationEvent === 'undefined') {
            window.addEventListener('deviceorientation', handleOrientation);
            window.addEventListener('devicemotion', handleMotion);
        }

        let watchId = null;
        if ('geolocation' in navigator) {
            watchId = navigator.geolocation.watchPosition(handleGPS, handleGPSError, {
                enableHighAccuracy: true,
                maximumAge: 0,
                timeout: 5000
            });
        }

        return () => {
            clearInterval(timer);
            window.removeEventListener('deviceorientation', handleOrientation);
            window.removeEventListener('devicemotion', handleMotion);
            if (watchId !== null) navigator.geolocation.clearWatch(watchId);
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
                        <p className={`text-xs ${textMutedClass}`}>
                            REAL-TIME DATA ONLY
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
                            title="Reset Peaks"
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

            <div className="space-y-3">

                {/* ACCELEROMETER */}
                <div className={`${cardClass} rounded-lg shadow-sm p-4 border ${borderClass}`}>
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-2">
                            <Activity className="w-5 h-5 text-red-500" />
                            <h2 className={`font-bold ${textClass}`}>ACCELEROMETER</h2>
                        </div>
                        <div className="flex items-center gap-2">
                            {!sensors.available.motion && <span className="text-xs text-red-500 font-bold animate-pulse">WAITING...</span>}
                            <button onClick={() => toggleInfo('accel')}><Info className={`w-4 h-4 ${textMutedClass}`} /></button>
                        </div>
                    </div>

                    {showInfo === 'accel' && (
                        <div className={`mb-3 p-2 rounded text-xs ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-blue-50 text-blue-800'}`}>
                            Measures proper acceleration (G-force). 1.00G is standard gravity. Shake device to test.
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-2 rounded bg-opacity-50 bg-gray-50 dark:bg-gray-900">
                            <p className={`text-xs ${textMutedClass} mb-1`}>CURRENT</p>
                            <p className={`text-3xl font-black ${textClass}`}>
                                {sensors.accelerometer.totalG.toFixed(2)}
                                <span className="text-sm ml-1 font-normal text-gray-500">G</span>
                            </p>
                        </div>
                        <div className="text-center p-2 rounded bg-opacity-50 bg-gray-50 dark:bg-gray-900">
                            <p className={`text-xs ${textMutedClass} mb-1`}>PEAK</p>
                            <p className="text-3xl font-black text-red-500">
                                {sensors.accelerometer.peakG.toFixed(2)}
                                <span className="text-sm ml-1 font-normal text-gray-500">G</span>
                            </p>
                        </div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs text-gray-500 font-mono">
                        <div>X: {sensors.accelerometer.x.toFixed(2)}</div>
                        <div>Y: {sensors.accelerometer.y.toFixed(2)}</div>
                        <div>Z: {sensors.accelerometer.z.toFixed(2)}</div>
                    </div>
                </div>

                {/* MAGNETOMETER / COMPASS */}
                <div className={`${cardClass} rounded-lg shadow-sm p-4 border ${borderClass}`}>
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-2">
                            <Navigation className="w-5 h-5 text-purple-500" />
                            <h2 className={`font-bold ${textClass}`}>COMPASS</h2>
                        </div>
                        <button onClick={() => toggleInfo('mag')}><Info className={`w-4 h-4 ${textMutedClass}`} /></button>
                    </div>

                    {showInfo === 'mag' && (
                        <div className={`mb-3 p-2 rounded text-xs ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-blue-50 text-blue-800'}`}>
                            Magnetic heading relative to North. Accuracy depends on device calibration.
                        </div>
                    )}

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
                                className="absolute w-1 h-8 bg-red-500 top-1/2 left-1/2 origin-bottom transform -translate-x-1/2 -translate-y-full rounded-full transition-transform duration-200"
                                style={{ transform: `translateX(-50%) translateY(-100%) rotate(${sensors.magnetometer.heading}deg)` }}
                            ></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full z-10"></div>
                        </div>
                    </div>
                </div>

                {/* GPS */}
                <div className={`${cardClass} rounded-lg shadow-sm p-4 border ${borderClass}`}>
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-2">
                            <MapPin className="w-5 h-5 text-blue-500" />
                            <h2 className={`font-bold ${textClass}`}>GPS</h2>
                        </div>
                        <div className="flex items-center gap-2">
                            {!sensors.available.gps && <span className="text-xs text-orange-500 font-bold animate-pulse">LOCATING...</span>}
                            <button onClick={() => toggleInfo('gps')}><Info className={`w-4 h-4 ${textMutedClass}`} /></button>
                        </div>
                    </div>

                    {showInfo === 'gps' && (
                        <div className={`mb-3 p-2 rounded text-xs ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-blue-50 text-blue-800'}`}>
                            Coordinates provided by device GPS/Wi-Fi. Altitude is WGS84 (ellipsoid), not MSL.
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <p className={`text-xs ${textMutedClass}`}>LATITUDE</p>
                            <p className={`font-mono font-bold ${textClass}`}>
                                {sensors.gps.latitude ? sensors.gps.latitude.toFixed(6) : '--'}
                            </p>
                        </div>
                        <div>
                            <p className={`text-xs ${textMutedClass}`}>LONGITUDE</p>
                            <p className={`font-mono font-bold ${textClass}`}>
                                {sensors.gps.longitude ? sensors.gps.longitude.toFixed(6) : '--'}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center">
                        <div className={`p-2 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                            <p className={`text-xs ${textMutedClass} mb-1`}>SPEED</p>
                            <p className={`font-bold ${textClass}`}>
                                {sensors.gps.speed ? (isMetric ? (sensors.gps.speed * 3.6).toFixed(1) : (sensors.gps.speed * 2.23694).toFixed(1)) : '0.0'}
                            </p>
                            <span className="text-[10px] text-gray-400">{isMetric ? 'km/h' : 'mph'}</span>
                        </div>
                        <div className={`p-2 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                            <p className={`text-xs ${textMutedClass} mb-1`}>ALT</p>
                            <p className={`font-bold ${textClass}`}>
                                {sensors.gps.altitude ? (isMetric ? sensors.gps.altitude.toFixed(0) : (sensors.gps.altitude * 3.28084).toFixed(0)) : '--'}
                            </p>
                            <span className="text-[10px] text-gray-400">{isMetric ? 'm' : 'ft'}</span>
                        </div>
                        <div className={`p-2 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                            <p className={`text-xs ${textMutedClass} mb-1`}>ACCURACY</p>
                            <p className={`font-bold ${textClass}`}>
                                {sensors.gps.accuracy ? (isMetric ? sensors.gps.accuracy.toFixed(0) : (sensors.gps.accuracy * 3.28084).toFixed(0)) : '--'}
                            </p>
                            <span className="text-[10px] text-gray-400">±{isMetric ? 'm' : 'ft'}</span>
                        </div>
                    </div>
                </div>

                <div className="text-center pt-4 opacity-50 text-[10px]">
                    <p>Sensors require HTTPS context & permissions.</p>
                    <p className="mt-1">Barometer/LiDAR are not available in web APIs on iOS.</p>
                </div>

            </div>
        </div>
    );
};

export default SensorMonitor;
