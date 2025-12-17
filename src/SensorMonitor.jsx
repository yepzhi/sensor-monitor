import React, { useState, useEffect, useRef } from 'react';
import { Activity, Navigation, RotateCcw, Info, Moon, MapPin, Gauge, Mic, ArrowUp, ArrowDown } from 'lucide-react';

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
            x: 0, y: 0, z: 0,
            totalG: 0,
            peakG: 0,
            vibration: 0
        },
        magnetometer: { heading: 0, accuracy: 0 },
        environment: {
            verticalSpeed: 0,
            pressureHPa: 1013.25,
            soundDb: 0,
            lux: null
        },
        available: {
            gps: false,
            motion: false,
            orientation: false,
            mic: false,
            light: false
        }
    });

    const lastGpsRef = useRef({ alt: null, time: null });
    const audioContextRef = useRef(null);

    // --- Helpers ---
    const calculatePressureFromAlt = (altMeters) => {
        const p0 = 1013.25;
        return p0 * Math.pow((1 - 2.25577e-5 * altMeters), 5.25588);
    };

    const getPressurePSI = () => (sensors.environment.pressureHPa * 0.0145038).toFixed(2);

    const getAirDensity = () => {
        const P = sensors.environment.pressureHPa * 100;
        const T = 293.15;
        const R = 287.05;
        return (P / (R * T)).toFixed(3);
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

    // --- Permission & Start Logic ---
    const requestPermissions = async () => {
        // 1. Motion/Orientation (iOS)
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            try {
                const permission = await DeviceOrientationEvent.requestPermission();
                if (permission === 'granted') setPermissionGranted(true);
            } catch (e) {
                alert("Motion Sensor Error: " + e.message);
            }
        } else {
            setPermissionGranted(true);
        }

        // 2. Microphone (Sound)
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            initAudio(stream);
        } catch (e) {
            console.warn("Mic access denied", e);
        }

        // 3. Generic Sensors (Android Chrome usually)
        initGenericSensors();
    };

    const initGenericSensors = () => {
        // Magnetometer (Real EMF)
        if ('Magnetometer' in window) {
            try {
                const MagnetometerClass = window['Magnetometer'];
                const mag = new MagnetometerClass({ frequency: 10 });
                mag.addEventListener('reading', () => {
                    const x = mag.x, y = mag.y, z = mag.z;
                    const totaluT = Math.sqrt(x * x + y * y + z * z);
                    setSensors(prev => ({
                        ...prev,
                        magnetometer: { ...prev.magnetometer, uT: totaluT },
                        available: { ...prev.available, magnetometer: true }
                    }));
                });
                mag.start();
            } catch (error) {
                console.log("Magnetometer not supported/allowed", error);
            }
        }

        // Barometer (Real Pressure) (flag required usually)
        // eslint-disable-next-line no-undef
        if ('Barometer' in window || (typeof Barometer !== 'undefined')) {
            try {
                // eslint-disable-next-line no-undef
                const BarometerClass = window['Barometer']; // defensive
                const bar = new BarometerClass({ frequency: 1 });
                bar.addEventListener('reading', () => {
                    setSensors(prev => ({
                        ...prev,
                        environment: { ...prev.environment, pressureHPa: bar.pressure, isBarometerReal: true },
                        available: { ...prev.available, barometer: true }
                    }));
                });
                bar.start();
            } catch (e) { console.log("Barometer error", e); }
        }

        // Ambient Light
        if ('AmbientLightSensor' in window) {
            try {
                const AmbientLightSensorClass = window['AmbientLightSensor'];
                const light = new AmbientLightSensorClass();
                light.addEventListener('reading', () => {
                    setSensors(prev => ({
                        ...prev,
                        environment: { ...prev.environment, lux: light.illuminance },
                        available: { ...prev.available, light: true }
                    }));
                });
                light.start();
            } catch (err) { console.log("Light sensor error", err); }
        }
    };

    const initAudio = (stream) => {
        // AudioContext strictness
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;

        if (!audioContextRef.current) {
            audioContextRef.current = new AudioContextClass();
        }
        const audioCtx = audioContextRef.current;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const updateAudio = () => {
            // Handle suspended state (autoplay policy)
            if (audioCtx.state === 'suspended') {
                audioCtx.resume().catch(e => console.warn("Audio resume failed", e));
            }

            analyser.getByteFrequencyData(dataArray);

            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) { sum += dataArray[i] * dataArray[i]; }
            const rms = Math.sqrt(sum / dataArray.length);
            const db = rms > 0 ? Math.round(20 * Math.log10(rms)) + 10 : 0;

            setSensors(prev => ({
                ...prev,
                environment: { ...prev.environment, soundDb: Math.max(30, db) },
                available: { ...prev.available, mic: true }
            }));
            requestAnimationFrame(updateAudio);
        };
        updateAudio();
    };

    // Throttling Refs
    const lastUpdate = useRef({
        motion: 0,
        vibration: 0,
        gps: 0,
        climb: 0
    });

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);

        const handleOrientation = (e) => {
            // Null check for heading
            let heading = e.webkitCompassHeading || (e.alpha ? 360 - e.alpha : 0) || 0;
            setSensors(prev => ({
                ...prev,
                magnetometer: { ...prev.magnetometer, heading, accuracy: e.webkitCompassAccuracy || 0 },
                available: { ...prev.available, orientation: true }
            }));
        };

        const handleMotion = (e) => {
            const now = Date.now();
            const acc = e.accelerationIncludingGravity;
            const lin = e.acceleration;
            if (!acc) return;

            const x = acc.x || 0, y = acc.y || 0, z = acc.z || 0;
            const total = Math.sqrt(x * x + y * y + z * z) / 9.81;

            // Updates to apply this frame
            let updates = {};
            let shouldUpdate = false;

            // 1. G-Force & Peak: Update every 300ms (.3s)
            if (now - lastUpdate.current.motion > 300) {
                updates.totalG = total;
                updates.x = x;
                updates.y = y;
                updates.z = z;
                lastUpdate.current.motion = now;
                shouldUpdate = true;
            }

            // 2. Vibration: Update every 1000ms (1s)
            if (lin && lin.x !== null && (now - lastUpdate.current.vibration > 1000)) {
                updates.vibration = Math.sqrt(lin.x * lin.x + lin.y * lin.y + lin.z * lin.z);
                lastUpdate.current.vibration = now;
                shouldUpdate = true;
            }

            if (shouldUpdate) {
                setSensors(prev => ({
                    ...prev,
                    accelerometer: {
                        ...prev.accelerometer,
                        ...updates,
                        // Always check peak against live value, but only set state if throttled
                        peakG: Math.max(prev.accelerometer.peakG, total)
                    },
                    available: { ...prev.available, motion: true }
                }));
            }
        };

        const handleGPS = (pos) => {
            const now = Date.now();
            const { latitude, longitude, altitude, accuracy, speed, heading } = pos.coords;
            const alt = altitude || 0;

            let updates = {};
            let shouldUpdate = false;

            // 1. Speed & Altitude: Update every 300ms (.3s)
            // Note: GPS hardware usually provides 1Hz updates, but we allow faster if available
            if (now - lastUpdate.current.gps > 300) {
                updates.gps = { latitude, longitude, altitude: alt, accuracy, speed: speed || 0, heading };
                lastUpdate.current.gps = now;
                shouldUpdate = true;
            }

            // 2. Climb Rate: Update every 1000ms (1s) for stability
            let vSpeedUpdate = {};
            if (now - lastUpdate.current.climb > 1000) {
                let vSpeed = 0;
                if (lastGpsRef.current.alt !== null && lastGpsRef.current.time) {
                    const dt = (now - lastGpsRef.current.time) / 1000;
                    const dh = alt - lastGpsRef.current.alt;
                    if (dt > 0) vSpeed = dh / dt;
                }
                // Save snaphost for next climb calc
                lastGpsRef.current = { alt: alt, time: now };

                vSpeedUpdate = { verticalSpeed: vSpeed };
                lastUpdate.current.climb = now;
                shouldUpdate = true;
            }

            if (shouldUpdate) {
                setSensors(prev => ({
                    ...prev,
                    gps: { ...prev.gps, ...(updates.gps || {}) },
                    environment: { ...prev.environment, ...vSpeedUpdate },
                    available: { ...prev.available, gps: true }
                }));
            }
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
            if (audioContextRef.current) audioContextRef.current.close();
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
                        <p className={`text-xs ${textMutedClass}`}>MULTI-SENSOR SYSTEM</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={requestPermissions} className={`px-3 py-2 bg-green-600 text-white font-bold rounded-full hover:bg-green-700 ${permissionGranted ? 'hidden' : ''}`}>START</button>
                        <button onClick={resetSensors} className={`p-2 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}><RotateCcw className="w-4 h-4" /></button>
                        <button onClick={() => setIsDark(!isDark)} className={`p-2 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}><Moon className={`w-4 h-4 ${isDark ? 'text-yellow-400' : 'text-gray-600'}`} /></button>
                        <button onClick={() => setIsMetric(!isMetric)} className="px-3 py-2 bg-blue-600 text-white font-bold rounded-full hover:bg-blue-700">{isMetric ? 'METRIC' : 'IMPERIAL'}</button>
                    </div>
                </div>
            </div>

            <div className="space-y-3">

                {/* 1. ACCELEROMETER + VIBRATION */}
                <div className={`${cardClass} rounded-lg shadow-sm p-4 border ${borderClass}`}>
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-2">
                            <Activity className="w-5 h-5 text-red-500" />
                            <h2 className={`font-bold ${textClass}`}>MOTION</h2>
                        </div>
                        <div className="flex items-center gap-2">
                            {!sensors.available.motion && <span className="text-xs text-red-500 font-bold animate-pulse">WAITING...</span>}
                            <button onClick={() => toggleInfo('accel')}><Info className={`w-4 h-4 ${textMutedClass}`} /></button>
                        </div>
                    </div>

                    {showInfo === 'accel' && (
                        <div className={`mb-3 p-2 rounded text-xs ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-blue-50 text-blue-800'}`}>
                            Measures G-force (Total) and Vibration intensity (Linear acceleration).
                        </div>
                    )}

                    <div className="grid grid-cols-3 gap-2">
                        <div className={`text-center p-2 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                            <p className={`text-xs ${textMutedClass} mb-1`}>G-FORCE</p>
                            <p className={`text-xl font-black ${textClass}`}>{sensors.accelerometer.totalG.toFixed(2)}</p>
                            <span className="text-[10px] text-gray-400">G</span>
                        </div>
                        <div className={`text-center p-2 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                            <p className={`text-xs ${textMutedClass} mb-1`}>PEAK</p>
                            <p className="text-xl font-black text-red-500">{sensors.accelerometer.peakG.toFixed(2)}</p>
                            <span className="text-[10px] text-gray-400">G</span>
                        </div>
                        <div className={`text-center p-2 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                            <p className={`text-xs ${textMutedClass} mb-1`}>VIBRATION</p>
                            <div className="flex justify-center items-center gap-1">
                                <Activity className={`w-4 h-4 ${sensors.accelerometer.vibration > 0.5 ? 'text-orange-500 animate-pulse' : 'text-gray-400'}`} />
                                <p className={`text-xl font-black ${textClass}`}>{sensors.accelerometer.vibration.toFixed(1)}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. GPS */}
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
                            Speed, Altitude (WGS84), and Climb Rate derived from GPS coordinates.
                        </div>
                    )}

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
                            <p className={`text-xs ${textMutedClass} mb-1`}>CLIMB</p>
                            <div className={`flex items-center justify-center gap-1 ${Math.abs(sensors.environment.verticalSpeed) > 0.5 ? 'text-blue-500' : textClass}`}>
                                <p className={`text-2xl font-black`}>
                                    {isMetric ? sensors.environment.verticalSpeed.toFixed(1) : (sensors.environment.verticalSpeed * 196.85).toFixed(0)}
                                </p>
                                {sensors.environment.verticalSpeed > 0.5 && <ArrowUp className="w-4 h-4" />}
                                {sensors.environment.verticalSpeed < -0.5 && <ArrowDown className="w-4 h-4" />}
                            </div>
                            <span className="text-[10px] text-gray-400">{isMetric ? 'm/s' : 'fpm'}</span>
                        </div>
                    </div>
                    <div className={`p-2 rounded ${isDark ? 'bg-gray-900 bg-opacity-50' : 'bg-gray-50'} text-center`}>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-[10px] text-gray-400">LATITUDE</p>
                                <p className={`font-mono text-gray-500 font-bold`}>{sensors.gps.latitude ? sensors.gps.latitude.toFixed(6) : '...'}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-400">LONGITUDE</p>
                                <p className={`font-mono text-gray-500 font-bold`}>{sensors.gps.longitude ? sensors.gps.longitude.toFixed(6) : '...'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. COMPASS + EMF */}
                <div className={`${cardClass} rounded-lg shadow-sm p-4 border ${borderClass}`}>
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-2">
                            <Navigation className="w-5 h-5 text-purple-500" />
                            <h2 className={`font-bold ${textClass}`}>MAGNETIC & COMPASS</h2>
                        </div>
                        <button onClick={() => toggleInfo('mag')}><Info className={`w-4 h-4 ${textMutedClass}`} /></button>
                    </div>

                    {showInfo === 'mag' && (
                        <div className={`mb-3 p-2 rounded text-xs ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-blue-50 text-blue-800'}`}>
                            <p className="mb-2"><strong>Magnetic Field (EMF):</strong> Raw µT reading. Requires 'Magnetometer' sensor (often blocked on iOS/Web).</p>
                            <p className="mb-2"><strong>True North (GPS):</strong> Uses GPS bearing when moving.</p>
                            <p><strong>Magnetic North:</strong> Uses device compass when stationary.</p>
                        </div>
                    )}

                    {/* EMF / uT Section */}
                    <div className={`mb-6 p-3 rounded-lg ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
                        <div className="flex justify-between items-end mb-2">
                            <div className="flex items-center gap-2">
                                <Activity className={`w-5 h-5 ${sensors.magnetometer.uT > 100 ? 'text-red-500' : sensors.magnetometer.uT > 40 ? 'text-yellow-500' : 'text-green-500'}`} />
                                <span className={`text-sm font-bold ${textClass}`}>EMF STRENGTH</span>
                            </div>
                            <div className="text-right">
                                <span className={`text-3xl font-black ${sensors.magnetometer.uT > 100 ? 'text-red-500' : sensors.magnetometer.uT > 40 ? 'text-yellow-500' : 'text-green-500'}`}>
                                    {sensors.magnetometer.uT ? sensors.magnetometer.uT.toFixed(1) : '--'}
                                </span>
                                <span className="text-xs text-gray-400 ml-1">µT</span>
                            </div>
                        </div>

                        <div className="w-full h-3 bg-gray-300 dark:bg-gray-700 rounded-full overflow-hidden relative">
                            <div
                                className="h-full transition-all duration-300 ease-out"
                                style={{
                                    width: `${Math.min(100, (sensors.magnetometer.uT || 0))}%`,
                                    background: `linear-gradient(90deg, #22c55e 0%, #eab308 40%, #ef4444 100%)`
                                }}
                            ></div>
                        </div>
                        <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                            <span>0 µT</span>
                            <span>{!sensors.magnetometer.uT && "SENSOR NOT AVAILABLE"}</span>
                            <span>100+ µT</span>
                        </div>
                    </div>

                    {/* Compass Section (True North Logic) */}
                    {(() => {
                        // Priority: GPS Heading (True North) IF moving > 2km/h, else Magnetic North
                        // Note: GPS heading is only valid when moving.
                        const speedKmh = sensors.gps.speed * 3.6;
                        const useGpsHeading = speedKmh > 3 && sensors.gps.heading !== null;
                        const displayHeading = useGpsHeading ? sensors.gps.heading : sensors.magnetometer.heading;
                        const headingType = useGpsHeading ? "GPS TRUE NORTH" : "MAGNETIC NORTH";

                        return (
                            <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
                                <div>
                                    <p className={`text-xs ${textMutedClass}`}>{headingType}</p>
                                    <p className={`text-2xl font-black ${textClass}`}>{Math.round(displayHeading)}°</p>
                                    <p className={`text-sm font-bold text-purple-500`}>{getCompassDirection(displayHeading)}</p>
                                </div>

                                <div className="relative w-24 h-24 flex items-center justify-center">
                                    <div className={`absolute w-full h-full border-4 ${isDark ? 'border-gray-700' : 'border-gray-200'} rounded-full`}></div>

                                    <div
                                        className="w-4 h-16 relative transition-transform duration-300 ease-out"
                                        style={{
                                            transform: `rotate(${displayHeading}deg)`,
                                            filter: 'drop-shadow(0px 2px 3px rgba(0,0,0,0.3))'
                                        }}
                                    >
                                        {/* Arrow: North Red, South White */}
                                        <div className="absolute top-0 w-0 h-0 border-l-[8px] border-r-[8px] border-b-[32px] border-l-transparent border-r-transparent border-b-red-500"></div>
                                        <div className="absolute bottom-0 w-0 h-0 border-l-[8px] border-r-[8px] border-t-[32px] border-l-transparent border-r-transparent border-t-gray-300"></div>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </div>

                {/* 4. ENVIRONMENT */}
                <div className={`${cardClass} rounded-lg shadow-sm p-4 border ${borderClass}`}>
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100 dark:border-gray-700">
                        <Gauge className="w-5 h-5 text-cyan-500" />
                        <h2 className={`font-bold ${textClass}`}>ENVIRONMENT</h2>
                        <button onClick={() => toggleInfo('env')} className="ml-auto"><Info className={`w-4 h-4 ${textMutedClass}`} /></button>
                    </div>

                    {showInfo === 'env' && (
                        <div className={`mb-3 p-2 rounded text-xs ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-blue-50 text-blue-800'}`}>
                            <p className="mb-1"><strong>Air Density:</strong> Calculated from Pressure. Only shown if real sensor available.</p>
                            <p className="mb-1"><strong>Pressure:</strong> Real sensor data only.</p>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 mb-3">
                        {/* Sound Meter */}
                        <div className={`p-2 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                            <div className="flex items-center gap-1 mb-1">
                                <Mic className={`w-3 h-3 ${sensors.available.mic ? 'text-red-500 animate-pulse' : 'text-gray-400'}`} />
                                <p className={`text-xs ${textMutedClass}`}>NOISE</p>
                            </div>
                            <p className={`text-lg font-bold ${textClass}`}>
                                {sensors.available.mic ? sensors.environment.soundDb : '--'} <span className="text-xs font-normal">dB</span>
                            </p>
                        </div>
                        {/* Air Density */}
                        <div className={`p-2 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                            <p className={`text-xs ${textMutedClass} mb-1`}>AIR DENSITY</p>
                            <p className={`text-lg font-bold ${textClass}`}>
                                {sensors.environment.isBarometerReal ? getAirDensity() : '--'} <span className="text-xs font-normal">kg/m³</span>
                            </p>
                        </div>
                    </div>

                    {/* Light / PSI Row */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className={`p-2 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                            <p className={`text-xs ${textMutedClass} mb-1`}>LIGHT</p>
                            <p className={`text-gray-400 text-xs italic`}>{sensors.available.light ? sensors.environment.lux + ' lux' : 'N/A'}</p>
                        </div>
                        <div className={`p-2 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                            <p className={`text-xs ${textMutedClass} mb-1`}>PRESSURE</p>
                            <div className="flex items-baseline gap-1">
                                <p className={`text-lg font-bold ${textClass}`}>
                                    {sensors.environment.isBarometerReal ? getPressurePSI() : '--'}
                                </p>
                                <span className="text-xs text-gray-400">PSI</span>
                            </div>
                            {!sensors.environment.isBarometerReal && <span className="text-[9px] text-red-400">NO SENSOR</span>}
                        </div>
                    </div>
                </div>

            </div>

            {/* Elegant Footer */}
            <div className="mt-8 mb-4 text-center border-t border-gray-200 dark:border-gray-800 pt-4">
                <p className={`text-[10px] ${textMutedClass} mb-2`}>
                    Data accuracy depends on device hardware.<br />
                    EMF/Light sensors require Android/Chrome support. v2.0
                </p>
                <a
                    href="http://yepzhi.com"
                    target="_blank"
                    rel="noreferrer"
                    className={`inline-flex items-center gap-1 text-xs font-bold ${isDark ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-black'} transition-colors duration-200 uppercase tracking-widest`}
                    style={{ letterSpacing: '0.15em' }}
                >
                    Developed by Yepzhi
                </a>
            </div>
        </div>
    );
};

export default SensorMonitor;
