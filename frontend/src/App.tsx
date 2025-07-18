import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import VideoPlayer from './components/VideoPlayer';
import TallyOverlay from './components/TallyOverlay';
import CameraSelector from './components/CameraSelector';
import ControlOverlay from './components/ControlOverlay';
import { useTallyFeedback } from './hooks/useTallyFeedback';
import { useWebSocket } from './hooks/useWebSocket';
import useSpeechSynthesis from './hooks/useSpeechSynthesis';
import AuthBranded from './components/Auth-Branded';
import Dashboard from './components/Dashboard';
import PrivateRoute from './components/PrivateRoute';
import AuthCallback from './components/AuthCallback';
import Landing from './pages/Landing';
import RegisterPD from './pages/RegisterPD';
import { useAuth } from './context/AuthContext';
import './styles/global.css';
import './App.css';

interface Input { number: string; name: string; }

const MainApp: React.FC = () => {
    const { logout } = useAuth();
    const HLS_STREAM_URL = '/ws/mediamtx/pgm_srt_raw/index.m3u8';
    const WEBRTC_STREAM_URL = '/ws/mediamtx/pgm_srt_raw/whep';
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const RELAY_URL = `${wsProtocol}//${window.location.host}/ws/relay`;

    const { lastMessage } = useWebSocket(RELAY_URL);
    const { speak } = useSpeechSynthesis();

    const [myInputNumber, setMyInputNumber] = useState<number | null>(() => JSON.parse(localStorage.getItem('myInputNumber') || 'null'));
    const [isVibrationEnabled, setIsVibrationEnabled] = useState<boolean>(() => JSON.parse(localStorage.getItem('isVibrationEnabled') || 'true'));
    const [isSoundEnabled, setIsSoundEnabled] = useState<boolean>(() => JSON.parse(localStorage.getItem('isSoundEnabled') || 'true'));

    const [inputs, setInputs] = useState<Input[]>([]);
    const [programInput, setProgramInput] = useState<number | null>(null);
    const [previewInput, setPreviewInput] = useState<number | null>(null);
    const [isControlVisible, setIsControlVisible] = useState(false);
    const controlTimeoutRef = useRef<number | null>(null);

    useTallyFeedback(myInputNumber!, programInput, previewInput, isVibrationEnabled, isSoundEnabled, speak);

    useEffect(() => {
        if (lastMessage !== null) {
            try {
                const data = JSON.parse(lastMessage.data);
                if (data.type === 'tally_update') {
                    setProgramInput(data.program);
                    setPreviewInput(data.preview);
                } else if (data.type === 'input_list' && data.inputs) {
                    setInputs(Object.entries(data.inputs).map(([n, name]) => ({ number: n, name: name as string })));
                }
            } catch (e) { console.error('Failed to parse message data:', e); }
        }
    }, [lastMessage]);

    const handleSelectCamera = (input: number) => {
        localStorage.setItem('myInputNumber', JSON.stringify(input));
        setMyInputNumber(input);
    };

    const toggleSetting = (setter: React.Dispatch<React.SetStateAction<boolean>>, key: string) => {
        setter(prev => {
            const newValue = !prev;
            localStorage.setItem(key, JSON.stringify(newValue));
            return newValue;
        });
    };

    const showControls = () => {
        setIsControlVisible(true);
        if (controlTimeoutRef.current) clearTimeout(controlTimeoutRef.current);
        controlTimeoutRef.current = window.setTimeout(() => setIsControlVisible(false), 3000);
    };

    if (!myInputNumber) {
        return <CameraSelector inputs={inputs} onSelect={handleSelectCamera} />;
    }

    return (
        <div className="App" onClick={showControls}>
            <button onClick={logout} style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 100 }}>Logout</button>
            <TallyOverlay {...{ programInput, previewInput, myInputNumber }}>
                <VideoPlayer {...{ hlsUrl: HLS_STREAM_URL, webrtcUrl: WEBRTC_STREAM_URL }} />
            </TallyOverlay>
            <ControlOverlay
                isVisible={isControlVisible}
                isVibrationEnabled={isVibrationEnabled}
                isSoundEnabled={isSoundEnabled}
                onVibrationToggle={() => toggleSetting(setIsVibrationEnabled, 'isVibrationEnabled')}
                onSoundToggle={() => toggleSetting(setIsSoundEnabled, 'isSoundEnabled')}
            />
        </div>
    );
};


function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<AuthBranded />} />
                <Route path="/register" element={<AuthBranded />} />
                <Route path="/register-pd" element={<RegisterPD />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/app" element={<PrivateRoute />}>
                    <Route path="/app" element={<MainApp />} />
                    <Route path="/app/dashboard" element={<Dashboard />} />
                </Route>
                <Route path="/play/:username" element={<VideoPlayer />} />
                <Route path="/staff/:sessionKey" element={<MainApp />} />
            </Routes>
        </Router>
    );
}

export default App;
