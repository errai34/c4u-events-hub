import React, { useState, useEffect } from 'react';
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, onSnapshot, updateDoc, doc, deleteDoc } from 'firebase/firestore';

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyB2SDQyc9-3Ih99F5R3-yedY29IfsktxQc",
  authDomain: "c4u-events-hub.firebaseapp.com",
  projectId: "c4u-events-hub",
  storageBucket: "c4u-events-hub.firebasestorage.app",
  messagingSenderId: "1051696323890",
  appId: "1:1051696323890:web:429d8268a1e1845284cb2b"
};

// Initialize Firebase
console.log("Starting Firebase initialization...");
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
console.log("Firebase initialized!");

const EVENT_CATEGORIES = [
  "Seminar",
  "Study Group",
  "Workshop",
  "Hackathon",
  "Talk",
  "Journal Club",
  "Reading Group",
  "Social",
  "Research Meeting",
  "Other"
];

const App = () => {
  // State management
  const [events, setEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [name, setName] = useState(localStorage.getItem('userName') || '');
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sortBy, setSortBy] = useState('attendees');
  const [showPastEvents, setShowPastEvents] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [newEvent, setNewEvent] = useState({
    title: '',
    date: '',
    time: '',
    location: '',
    description: '',
    category: ''
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Firebase listener setup
  useEffect(() => {
    console.log("Setting up Firebase listener...");
    try {
      const unsubscribe = onSnapshot(collection(db, "events"), (snapshot) => {
        console.log("Got Firebase snapshot, size:", snapshot.size);
        const eventsData = [];
        snapshot.forEach((doc) => {
          eventsData.push({ id: doc.id, ...doc.data() });
        });
        setEvents(eventsData);
        setLoading(false);
      }, (error) => {
        console.error("Firebase snapshot error:", error);
        setError("Failed to load events: " + error.message);
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (err) {
      console.error("Firebase setup error:", err);
      setError("Failed to setup Firebase: " + err.message);
      setLoading(false);
    }
  }, []);

  // Filter and sort events
  useEffect(() => {
    let filtered = [...events];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(event => 
        event.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.location?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Category filter
    if (selectedCategory) {
      filtered = filtered.filter(event => event.category === selectedCategory);
    }

    // Past events filter
    if (!showPastEvents) {
      filtered = filtered.filter(event => new Date(event.date) >= new Date());
    }

    // Sort events
    filtered.sort((a, b) => {
      if (sortBy === 'attendees') {
        return (b.attendees?.length || 0) - (a.attendees?.length || 0);
      } else {
        return new Date(a.date) - new Date(b.date);
      }
    });

    setFilteredEvents(filtered);
  }, [events, searchTerm, selectedCategory, sortBy, showPastEvents]);

  // Helper functions
  const showSuccess = (message) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const formatTime = (time) => {
    if (!time) return '';
    try {
      const [hours, minutes] = time.split(':');
      const timeObj = new Date();
      timeObj.setHours(hours);
      timeObj.setMinutes(minutes);
      return timeObj.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch (e) {
      return time;
    }
  };

  const handleNameSet = (newName) => {
    console.log("Setting name:", newName);
    if (newName.trim()) {
      localStorage.setItem('userName', newName.trim());
      setName(newName.trim());
      setShowNamePrompt(false);
    }
  };

  // Event handlers
  const handleAddEvent = async (e) => {
    e.preventDefault();
    if (!name) {
      setShowNamePrompt(true);
      return;
    }
    
    setLoading(true);
    try {
      await addDoc(collection(db, "events"), {
        ...newEvent,
        createdAt: new Date().toISOString(),
        postedBy: name,
        attendees: [name]
      });
      setNewEvent({ title: '', date: '', time: '', location: '', description: '', category: '' });
      showSuccess('Event created successfully! 🎉');
    } catch (err) {
      setError("Failed to add event: " + err.message);
    }
    setLoading(false);
  };

  const handleJoin = async (eventId) => {
    if (!name) {
      setShowNamePrompt(true);
      return;
    }
    
    setLoading(true);
    try {
      const eventRef = doc(db, "events", eventId);
      const event = events.find(e => e.id === eventId);
      const attendees = event.attendees || [];
      if (!attendees.includes(name)) {
        await updateDoc(eventRef, {
          attendees: [...attendees, name]
        });
        showSuccess("You've joined the event! 🎉");
      }
    } catch (err) {
      setError("Failed to join event: " + err.message);
    }
    setLoading(false);
  };

  const handleLeave = async (eventId) => {
    setShowConfirmModal({
      title: "Leave Event",
      message: "Are you sure you want to leave this event?",
      onConfirm: async () => {
        setLoading(true);
        try {
          const eventRef = doc(db, "events", eventId);
          const event = events.find(e => e.id === eventId);
          const attendees = event.attendees || [];
          await updateDoc(eventRef, {
            attendees: attendees.filter(attendee => attendee !== name)
          });
          showSuccess("You've left the event");
        } catch (err) {
          setError("Failed to leave event: " + err.message);
        }
        setLoading(false);
        setShowConfirmModal(null);
      }
    });
  };

  const handleDelete = async (eventId) => {
    setShowConfirmModal({
      title: "Delete Event",
      message: "Are you sure you want to delete this event?",
      onConfirm: async () => {
        setLoading(true);
        try {
          await deleteDoc(doc(db, "events", eventId));
          showSuccess("Event deleted successfully");
        } catch (err) {
          setError("Failed to delete event: " + err.message);
        }
        setLoading(false);
        setShowConfirmModal(null);
      }
    });
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '24px', margin: 0 }}>C4U Relevant Events @Stanford 🎓</h1>
        {name ? (
          <div>
            Hi, {name}! 👋
            <button 
              onClick={() => setName('')}
              style={{ marginLeft: '10px', color: '#4444ff', border: 'none', background: 'none', cursor: 'pointer' }}
            >
              (change)
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowNamePrompt(true)}
            style={{
              padding: '8px 16px',
              background: '#4444ff',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            Join here 🎉
          </button>
        )}
      </div>

      {/* Search and Filter Section */}
      <div style={{ 
        background: 'white',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
          <input
            type="text"
            placeholder="Search events..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ 
              flex: 1,
              padding: '8px',
              borderRadius: '4px',
              border: '1px solid #ddd'
            }}
          />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{
              padding: '8px',
              borderRadius: '4px',
              border: '1px solid #ddd'
            }}
          >
            <option value="">All Categories</option>
            {EVENT_CATEGORIES.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              padding: '8px',
              borderRadius: '4px',
              border: '1px solid #ddd'
            }}
          >
            <option value="attendees">Sort by Popularity</option>
            <option value="date">Sort by Date</option>
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <input
              type="checkbox"
              checked={showPastEvents}
              onChange={(e) => setShowPastEvents(e.target.checked)}
            />
            Show Past Events
          </label>
        </div>
      </div>

      {/* Add Event Form */}
      <div style={{ 
        background: 'white',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        marginBottom: '20px'
      }}>
        <h2 style={{ marginTop: 0, 
        fontSize: '1.1rem',  // Reduced from 1.5rem
        color: '#2E2D4D', 
        lineHeight: 1.3 }}>Where the Universe Decoders meet AI & ML 🪐.</h2>

        <form onSubmit={handleAddEvent} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input
            type="text"
            placeholder="What's happening? (e.g., ML Study Group)"
            value={newEvent.title}
            onChange={e => setNewEvent(prev => ({ ...prev, title: e.target.value }))}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
            required
          />
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              type="date"
              value={newEvent.date}
              onChange={e => setNewEvent(prev => ({ ...prev, date: e.target.value }))}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd', flex: 1 }}
              required
            />
            <input
              type="time"
              value={newEvent.time}
              onChange={e => setNewEvent(prev => ({ ...prev, time: e.target.value }))}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd', flex: 1 }}
              required
            />
            <input
              type="text"
              placeholder="Where? 📍"
              value={newEvent.location}
              onChange={e => setNewEvent(prev => ({ ...prev, location: e.target.value }))}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd', flex: 1 }}
              required
            />
          </div>
          <select
            value={newEvent.category}
            onChange={e => setNewEvent(prev => ({ ...prev, category: e.target.value }))}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
            required
          >
            <option value="">Select Category</option>
            {EVENT_CATEGORIES.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Add a fun description! 💭"
            value={newEvent.description}
            onChange={e => setNewEvent(prev => ({ ...prev, description: e.target.value }))}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
          />
          <button
            type="submit"
            style={{
              padding: '8px',
              background: '#44bb44',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Share the Knowledge! 📚
          </button>
        </form>
      </div>

      {/* Events List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {filteredEvents.length === 0 ? (
          <div style={{ 
            padding: '20px', 
            background: '#f8f8f8', 
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            {searchTerm || selectedCategory ? 
              'No events found matching your criteria 🔍' : 
              'No events yet! Be the first to share one! 🌟'}
          </div>
        ) : (
          filteredEvents.map(event => (
            <div 
              key={event.id} 
              style={{
                background: 'white',
                padding: '20px',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <h3 style={{ margin: 0, fontSize: '18px' }}>{event.title}</h3>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    {event.attendees?.includes(name) ? (
                      <button
                        onClick={() => handleLeave(event.id)}
                        style={{
                          padding: '8px 16px',
                          background: '#ff8800',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        Leave event 👋
                      </button>
                    ) : (
                      <button
                        onClick={() => handleJoin(event.id)}
                        style={{
                          padding: '8px 16px',
                          background: '#4444ff',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        Sign up 🤝
                      </button>
                    )}
                    {event.postedBy === name && (
                      <button
                        onClick={() => handleDelete(event.id)}
                        style={{
                          padding: '8px 16px',
                          background: '#ff4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        Delete 🗑️
                      </button>
                    )}
                  </div>
                </div>
                
                <div style={{ color: '#666666', marginBottom: '10px' }}>
                  📅 {new Date(event.date).toLocaleDateString()} at {formatTime(event.time)} | 
                  📍 {event.location} |
                  🏷️ {event.category} |
                  👥 {event.attendees?.length || 0} joining
                </div>
                
                {event.description && (
                  <p style={{ color: '#666666', margin: '10px 0' }}>{event.description}</p>
                )}
                
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {event.attendees?.map(attendee => (
                    <span
                      key={attendee}
                      style={{
                        padding: '4px 8px',
                        background: '#e6f0ff',
                        color: '#4444ff',
                        borderRadius: '100px',
                        fontSize: '14px'
                      }}
                    >
                      {attendee}
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
  
        {/* Name Prompt Modal */}
        {showNamePrompt && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 1000
          }}>
            <div style={{
              background: 'white',
              padding: '20px',
              borderRadius: '8px',
              maxWidth: '400px',
              width: '100%'
            }}>
              <h2 style={{ marginTop: 0 }}>What should we call you? 😊</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleNameSet(e.target.name.value);
                }}
                style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
              >
                <input
                  name="name"
                  type="text"
                  placeholder="Your name"
                  style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                  required
                  autoFocus
                />
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setShowNamePrompt(false)}
                    style={{ padding: '8px 16px', border: '1px solid #ddd', borderRadius: '4px', background: 'white' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{
                      padding: '8px 16px',
                      background: '#4444ff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px'
                    }}
                  >
                    Let's Go! 🚀
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
  
        {/* Confirmation Modal */}
        {showConfirmModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 1000
          }}>
            <div style={{
              background: 'white',
              padding: '20px',
              borderRadius: '8px',
              maxWidth: '400px',
              width: '100%'
            }}>
              <h3 style={{ marginTop: 0 }}>{showConfirmModal.title}</h3>
              <p>{showConfirmModal.message}</p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowConfirmModal(null)}
                  style={{
                    padding: '8px 16px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    background: 'white'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={showConfirmModal.onConfirm}
                  style={{
                    padding: '8px 16px',
                    background: '#ff4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px'
                  }}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}
  
        {/* Loading Indicator */}
        {loading && (
          <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(0,0,0,0.8)',
            color: 'white',
            padding: '20px',
            borderRadius: '8px',
            zIndex: 1000
          }}>
            Loading...
          </div>
        )}
  
        {/* Success Message */}
        {successMessage && (
          <div style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            background: '#44bb44',
            color: 'white',
            padding: '10px 20px',
            borderRadius: '4px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            zIndex: 1000
          }}>
            {successMessage}
          </div>
        )}
  
        {/* Error Message */}
        {error && (
          <div style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            background: '#ff4444',
            color: 'white',
            padding: '10px 20px',
            borderRadius: '4px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            zIndex: 1000
          }}>
            {error}
            <button
              onClick={() => setError(null)}
              style={{
                marginLeft: '10px',
                background: 'none',
                border: 'none',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              ✕
            </button>
          </div>
        )}
      </div>
    );
  };
  
  export default App;