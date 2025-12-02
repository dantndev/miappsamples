import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Play, Pause, Search, Folder, Music, Plus, HardDrive, Filter, FileAudio
} from 'lucide-react';

const detectMetadata = (filename) => {
  const bpmMatch = filename.match(/(\d{2,3})\s?bpm/i);
  const keyMatch = filename.match(/([A-G][#b]?)\s?(min|maj|m)/i);
  let category = 'Other';
  const lower = filename.toLowerCase();
  if (lower.includes('kick')) category = 'Kick';
  else if (lower.includes('snare')) category = 'Snare';
  else if (lower.includes('hat')) category = 'HiHat';
  else if (lower.includes('bass')) category = 'Bass';
  else if (lower.includes('loop')) category = 'Loop';
  
  return {
    bpm: bpmMatch ? parseInt(bpmMatch[1]) : null,
    key: keyMatch ? keyMatch[0].toUpperCase() : null,
    category
  };
};

const Waveform = ({ playing }) => {
  return (
    <div className="w-full h-full flex items-center gap-[2px] opacity-60">
      {Array.from({ length: 30 }).map((_, i) => (
        <div key={i} 
          className={`w-1 rounded-full bg-blue-500 transition-all duration-300`}
          style={{ 
            height: playing ? `${Math.random() * 100}%` : `${20 + Math.random() * 50}%`,
            opacity: playing ? 1 : 0.5 
          }}
        />
      ))}
    </div>
  );
};

export default function SampleManagerApp() {
  const [samples, setSamples] = useState([]);
  const [libraries, setLibraries] = useState([]);
  const [currentView, setCurrentView] = useState('pool'); 
  const [playingId, setPlayingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const audioRef = useRef(new Audio());

  const [showImportModal, setShowImportModal] = useState(false);
  const [importConfig, setImportConfig] = useState({ name: '', genre: '' });

  const startImportProcess = () => {
    setImportConfig({ name: '', genre: '' }); 
    setShowImportModal(true);
  }

  // Ahora 'type' puede ser 'folder' o 'files'
  const handleImport = async (type) => {
    setShowImportModal(false); 
    try {
      // Llamamos a la nueva función del backend pasándole el tipo
      const result = await window.electron.ipcRenderer.invoke('import-content', type);
      
      if (result && result.files.length > 0) {
        const finalLibName = importConfig.name.trim() !== '' ? importConfig.name : result.folderName;
        const globalGenre = importConfig.genre.trim();

        const processed = result.files.map(f => {
          const meta = detectMetadata(f.name);
          return {
            ...f, 
            id: f.path, 
            library: finalLibName, 
            category: globalGenre !== '' ? globalGenre : meta.category,
            bpm: meta.bpm,
            key: meta.key
          };
        });

        setSamples(prev => [...prev, ...processed]);
        if (!libraries.includes(finalLibName)) setLibraries(p => [...p, finalLibName]);
        setCurrentView(finalLibName);
      } else if (result) {
        alert("No se encontraron audios válidos.");
      }
    } catch (e) { 
      console.error(e); 
      alert("Error al importar.");
    }
  };

  const handleDragToDAW = (e, path) => {
    e.preventDefault();
    window.electron.ipcRenderer.send('ondragstart', path);
  };

  const togglePlay = (s) => {
    if (playingId === s.id) {
      audioRef.current.pause();
      setPlayingId(null);
    } else {
      // 1. Normalizar separadores para Windows (cambiar \ por /)
      const cleanPath = s.path.replace(/\\/g, '/');
      
      // 2. Codificar la URI para soportar espacios y caracteres especiales
      // Es crucial reemplazar manualmente '#' porque encodeURI no lo hace y rompe la URL
      const encodedPath = encodeURI(cleanPath).replace(/#/g, '%23').replace(/\?/g, '%3F');
      
      // 3. Asignar la fuente con protocolo file:///
      audioRef.current.src = `file:///${encodedPath}`;
      
      console.log("Reproduciendo:", audioRef.current.src); // Debug en consola
      
      audioRef.current.play()
        .then(() => setPlayingId(s.id))
        .catch(e => console.error("Error reproducción. Asegúrate de reiniciar la app tras los cambios en main.js", e));
    }
  };

  const filtered = samples.filter(s => {
    if (currentView !== 'pool' && s.library !== currentView) return false;
    return s.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="flex h-screen bg-[#121212] text-gray-300 font-sans overflow-hidden relative">
      
      {/* MODAL ACTUALIZADO */}
      {showImportModal && (
        <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1f1f1f] border border-gray-700 p-6 rounded-lg w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-4">Añadir Samples</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1 uppercase font-bold">Nombre de Librería (Opcional)</label>
                <input 
                  type="text" 
                  placeholder="Ej: Favoritos Diciembre"
                  className="w-full bg-[#121212] border border-gray-700 rounded p-2 text-white focus:border-blue-500 outline-none"
                  value={importConfig.name}
                  onChange={(e) => setImportConfig({...importConfig, name: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1 uppercase font-bold">Género (Opcional)</label>
                <input 
                  type="text" 
                  placeholder="Ej: Techno"
                  className="w-full bg-[#121212] border border-gray-700 rounded p-2 text-white focus:border-blue-500 outline-none"
                  value={importConfig.genre}
                  onChange={(e) => setImportConfig({...importConfig, genre: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-3 mt-6">
                <button 
                  onClick={() => handleImport('folder')}
                  className="px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-bold flex items-center justify-center gap-2"
                >
                  <Folder size={18} /> Escanear Carpeta
                </button>
                <button 
                  onClick={() => handleImport('files')}
                  className="px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm font-bold flex items-center justify-center gap-2"
                >
                  <FileAudio size={18} /> Elegir Archivos
                </button>
              </div>
              <button onClick={() => setShowImportModal(false)} className="w-full text-center text-xs text-gray-500 hover:text-white mt-2">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div className="w-64 bg-[#1a1a1a] border-r border-gray-800 flex flex-col">
        <div className="p-4 flex items-center gap-2 drag-region">
          <div className="bg-blue-600 p-1 rounded"><Music size={16} color="white"/></div>
          <span className="font-bold text-white">SPLICE LOCAL</span>
        </div>
        <div className="p-2 space-y-1">
          <button onClick={() => setCurrentView('pool')} className={`w-full text-left px-3 py-2 rounded flex items-center gap-2 text-sm ${currentView === 'pool' ? 'bg-blue-900/40 text-blue-400' : 'hover:bg-gray-800'}`}>
            <HardDrive size={14}/> Pool Global ({samples.length})
          </button>
          <div className="pt-4 px-3 flex justify-between text-xs font-bold text-gray-500">
            LIBRERÍAS <Plus size={14} className="cursor-pointer hover:text-white" onClick={startImportProcess}/>
          </div>
          {libraries.map(lib => (
            <button key={lib} onClick={() => setCurrentView(lib)} className={`w-full text-left px-3 py-2 rounded flex items-center gap-2 text-sm truncate ${currentView === lib ? 'bg-blue-900/40 text-blue-400' : 'hover:bg-gray-800'}`}>
              <Folder size={14}/> {lib}
            </button>
          ))}
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col">
        <div className="h-14 border-b border-gray-800 flex items-center px-4 gap-4 drag-region">
          <Search size={16} className="text-gray-500"/>
          <input className="bg-transparent outline-none flex-1 text-sm no-drag" placeholder="Buscar..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}/>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-600 gap-4">
              <Filter size={40} />
              <p>Arrastra carpetas o usa el botón (+) para empezar</p>
            </div>
          ) : (
            filtered.map(s => (
              <div key={s.id} draggable onDragStart={(e) => handleDragToDAW(e, s.path)} 
                className={`flex items-center gap-4 px-4 py-3 border-b border-gray-800/50 hover:bg-[#252525] group select-none ${playingId === s.id ? 'bg-[#1e2530]' : ''}`}
                onDoubleClick={() => togglePlay(s)}
              >
                <button onClick={() => togglePlay(s)}>
                  {playingId === s.id ? <Pause size={16} className="text-blue-400"/> : <Play size={16}/>}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">{s.name}</div>
                  <div className="text-xs text-gray-500">{s.library}</div>
                </div>
                <div className="w-32 h-6"><Waveform playing={playingId === s.id}/></div>
                <div className="w-16 text-center text-xs text-gray-400 font-mono bg-gray-800 rounded px-1">{s.bpm || '-'}</div>
                <div className="w-16 text-center text-xs text-gray-400 font-mono bg-gray-800 rounded px-1">{s.key || '-'}</div>
                <div className="w-20 text-right text-xs text-gray-500">{s.category}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}