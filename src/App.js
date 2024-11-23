import React, { useState, useEffect } from 'react';
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, onSnapshot, updateDoc, doc, deleteDoc } from 'firebase/firestore';

// Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyB2SDQyc9-3Ih99F5R3-yedY29IfsktxQc",
  authDomain: "c4u-events-hub.firebaseapp.com",
  projectId: "c4u-events-hub",
  storageBucket: "c4u-events-hub.firebasestorage.app",
  messagingSenderId: "1051696323890",
  appId: "1:1051696323890:web:429d8268a1e1845284cb2b"
};

console.log("Starting Firebase initialization...");
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
console.log("Firebase initialized!");

const App = () => {
  const [events, setEvents] = useState([]);
  const [name, setName] = useState(localStorage.getItem('userName') || '');
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '',
    date: '',
    time: '',
    location: '',
    description: ''
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    console.log("Setting up Firebase listener...");
    try {
      const unsubscribe = onSnapshot(collection(db, "events"), (snapshot) => {
        console.log("Got Firebase snapshot, size:", snapshot.size);
        const eventsData = [];
        snapshot.forEach((doc) => {
          eventsData.push({ id: doc.id, ...doc.data() });
        });
        console.log("Processed events:", eventsData);
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

  const handleNameSet = (newName) => {
    console.log("Setting name:", newName);
    if (newName.trim()) {
      localStorage.setItem('userName', newName.trim());
      setName(newName.trim());
      setShowNamePrompt(false);
    }
  };

  const handleAddEvent = async (e) => {
    e.preventDefault();
    console.log("Adding new event...");
    if (!name) {
      setShowNamePrompt(true);
      return;
    }
    
    try {
      const docRef = await addDoc(collection(db, "events"), {
        ...newEvent,
        createdAt: new Date().toISOString(),
        postedBy: name,
        attendees: [name]
      });
      console.log("Event added successfully, id:", docRef.id);
      setNewEvent({ title: '', date: '', time: '', location: '', description: '' });
    } catch (err) {
      console.error("Error adding event:", err);
      setError("Failed to add event: " + err.message);
    }
  };

  const handleJoin = async (eventId) => {
    console.log("Joining event:", eventId);
    if (!name) {
      setShowNamePrompt(true);
      return;
    }
    
    try {
      const eventRef = doc(db, "events", eventId);
      const event = events.find(e => e.id === eventId);
      const attendees = event.attendees || [];
      if (!attendees.includes(name)) {
        await updateDoc(eventRef, {
          attendees: [...attendees, name]
        });
        console.log("Successfully joined event");
      }
    } catch (err) {
      console.error("Error joining event:", err);
      setError("Failed to join event: " + err.message);
    }
  };

  const handleDelete = async (eventId) => {
    console.log("Deleting event:", eventId);
    try {
      await deleteDoc(doc(db, "events", eventId));
      console.log("Event deleted successfully");
    } catch (err) {
      console.error("Error deleting event:", err);
      setError("Failed to delete event: " + err.message);
    }
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

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '24px', margin: 0 }}>C4U Relevant Events @ Stanford 🎓</h1>
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
            Join the fun! 🎉
          </button>
        )}
      </div>

      {/* Add Event Form */}
      <div style={{ 
        background: 'white', 
        padding: '20px', 
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        marginBottom: '20px'
      }}>
        <h2 style={{ marginTop: 0 }}>ML, so much ML? No, more. 🚀</h2>
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
        {events.length === 0 ? (
          <div style={{ 
            padding: '20px', 
            background: '#f8f8f8', 
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            No events yet! Be the first to share one! 🌟
          </div>
        ) : (
          events.map(event => (
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
                  <button
                    onClick={() => handleJoin(event.id)}
                    disabled={event.attendees?.includes(name)}
                    style={{
                      padding: '8px 16px',
                      background: event.attendees?.includes(name) ? '#dddddd' : '#4444ff',
                      color: event.attendees?.includes(name) ? '#666666' : 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: event.attendees?.includes(name) ? 'default' : 'pointer'
                    }}
                  >
                    {event.attendees?.includes(name) ? "You're going! 🎉" : "Join in! 🤝"}
                  </button>
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
          padding: '20px'
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
    </div>
  );
};

export default App;