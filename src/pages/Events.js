// src/pages/Events.js
import React, { useState, useEffect, useContext } from 'react';
import { collection, addDoc, onSnapshot, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { AuthContext } from '../context/AuthContext';

const EVENT_CATEGORIES = [
  "Research Meeting",
  "Talk",
  "Journal Club",
  "Workshop",
  "Hackathon",
  "Conference",
  "Social",
  "Other"
];

const Events = () => {
  const { user } = useContext(AuthContext);

  const [events, setEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
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

  // Listen to Firestore "events" collection
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "events"),
      (snapshot) => {
        const eventsData = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data()
        }));
        setEvents(eventsData);
        setLoading(false);
      },
      (err) => {
        console.error("Firebase snapshot error:", err);
        setError("Failed to load events: " + err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Filter and sort events
  useEffect(() => {
    let filtered = [...events];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter((ev) =>
        ev.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ev.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ev.location?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Category filter
    if (selectedCategory) {
      filtered = filtered.filter((ev) => ev.category === selectedCategory);
    }

    // Past events filter
    if (!showPastEvents) {
      filtered = filtered.filter((ev) => new Date(ev.date) >= new Date());
    }

    // Sort events
    if (sortBy === 'attendees') {
      filtered.sort((a, b) => (b.attendees?.length || 0) - (a.attendees?.length || 0));
    } else {
      filtered.sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    setFilteredEvents(filtered);
  }, [events, searchTerm, selectedCategory, sortBy, showPastEvents]);

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
    } catch {
      return time;
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Event handlers
  // ─────────────────────────────────────────────────────────────────────────

  // Create a new event
  const handleAddEvent = async (e) => {
    e.preventDefault();
    if (!user) {
      alert("Please sign in from the top navigation first.");
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, "events"), {
        ...newEvent,
        createdAt: new Date().toISOString(),
        postedBy: user.uid,
        // Store the first attendee as an object
        attendees: [
          {
            uid: user.uid,
            name: user.displayName || user.email || "Unknown User"
          }
        ]
      });

      setNewEvent({
        title: '',
        date: '',
        time: '',
        location: '',
        description: '',
        category: ''
      });
      showSuccess('Event created successfully! 🎉');
    } catch (err) {
      setError("Failed to add event: " + err.message);
    }
    setLoading(false);
  };

  // Join an event
  const handleJoin = async (eventId) => {
    if (!user) {
      alert("Please sign in from the top navigation first.");
      return;
    }

    setLoading(true);
    try {
      const eventRef = doc(db, "events", eventId);
      const ev = events.find((e) => e.id === eventId);

      // Normalize old "attendees" arrays that might be just string UIDs
      const oldAttendees = ev.attendees || [];
      const normalizedAttendees = oldAttendees.map((a) => {
        return typeof a === "string" ? { uid: a, name: "" } : a;
      });

      // Check if this user is already in the event
      const alreadyJoined = normalizedAttendees.some((a) => a.uid === user.uid);
      if (alreadyJoined) {
        showSuccess("You're already in this event!");
      } else {
        // Add this user as { uid, name }
        const newAttendee = {
          uid: user.uid,
          name: user.displayName || user.email || "Unknown User"
        };
        const updatedAttendees = [...normalizedAttendees, newAttendee];

        await updateDoc(eventRef, { attendees: updatedAttendees });
        showSuccess("You've joined the event! 🎉");
      }
    } catch (err) {
      setError("Failed to join event: " + err.message);
    }
    setLoading(false);
  };

  // Leave an event
  const handleLeave = async (eventId) => {
    setShowConfirmModal({
      title: "Leave Event",
      message: "Are you sure you want to leave this event?",
      onConfirm: async () => {
        setLoading(true);
        try {
          const eventRef = doc(db, "events", eventId);
          const ev = events.find((e) => e.id === eventId);
          const oldAttendees = ev.attendees || [];

          // Normalize older string-based attendees to objects
          const normalizedAttendees = oldAttendees.map((a) => {
            return typeof a === "string" ? { uid: a, name: "" } : a;
          });

          const updated = normalizedAttendees.filter(
            (a) => a.uid !== user.uid
          );

          await updateDoc(eventRef, { attendees: updated });
          showSuccess("You've left the event");
        } catch (err) {
          setError("Failed to leave event: " + err.message);
        }
        setLoading(false);
        setShowConfirmModal(null);
      }
    });
  };

  // Delete an event (only creator)
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

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '24px', margin: 0 }}>
          C4U Relevant Events @Stanford 🎓
        </h1>
        {user ? (
          <div style={{ marginTop: '8px' }}>
            Hi, {user.displayName || user.email || 'User'}! 👋
          </div>
        ) : (
          <div style={{ marginTop: '8px', color: '#666' }}>
            You are not signed in. Please sign in from the top navigation to join or create events.
          </div>
        )}
      </div>

      {/* Search + Filter Section */}
      <div
        style={{
          background: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          marginBottom: '20px'
        }}
      >
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
            {EVENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
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
      <div
        style={{
          background: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          marginBottom: '20px'
        }}
      >
        <h2
          style={{
            marginTop: 0,
            fontSize: '1.1rem',
            color: '#2E2D4D',
            lineHeight: 1.3
          }}
        >
          Where the Universe Decoders meet AI & ML 🪐.
        </h2>

        <form
          onSubmit={handleAddEvent}
          style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
        >
          <input
            type="text"
            placeholder="What's happening? (e.g., ML Study Group)"
            value={newEvent.title}
            onChange={(e) =>
              setNewEvent((prev) => ({ ...prev, title: e.target.value }))
            }
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
            required
          />
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              type="date"
              value={newEvent.date}
              onChange={(e) =>
                setNewEvent((prev) => ({ ...prev, date: e.target.value }))
              }
              style={{
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #ddd',
                flex: 1
              }}
              required
            />
            <input
              type="time"
              value={newEvent.time}
              onChange={(e) =>
                setNewEvent((prev) => ({ ...prev, time: e.target.value }))
              }
              style={{
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #ddd',
                flex: 1
              }}
              required
            />
            <input
              type="text"
              placeholder="Where? 📍"
              value={newEvent.location}
              onChange={(e) =>
                setNewEvent((prev) => ({ ...prev, location: e.target.value }))
              }
              style={{
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #ddd',
                flex: 1
              }}
              required
            />
          </div>
          <select
            value={newEvent.category}
            onChange={(e) =>
              setNewEvent((prev) => ({ ...prev, category: e.target.value }))
            }
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
            required
          >
            <option value="">Select Category</option>
            {EVENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Add a fun description! 💭"
            value={newEvent.description}
            onChange={(e) =>
              setNewEvent((prev) => ({ ...prev, description: e.target.value }))
            }
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
          <div
            style={{
              padding: '20px',
              background: '#f8f8f8',
              borderRadius: '8px',
              textAlign: 'center'
            }}
          >
            {searchTerm || selectedCategory
              ? 'No events found matching your criteria 🔍'
              : 'No events yet! Be the first to share one! 🌟'}
          </div>
        ) : (
          filteredEvents.map((ev) => (
            <div
              key={ev.id}
              style={{
                background: 'white',
                padding: '20px',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
            >
              {/* Event Header / Title */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '10px'
                }}
              >
                <h3 style={{ margin: 0, fontSize: '18px' }}>{ev.title}</h3>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {/* Join / Leave logic */}
                  {user ? (
                    // Already in attendees?
                    ev.attendees?.some((a) =>
                      typeof a === "object" ? a.uid === user.uid : a === user.uid
                    ) ? (
                      <button
                        onClick={() => handleLeave(ev.id)}
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
                        onClick={() => handleJoin(ev.id)}
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
                    )
                  ) : (
                    // Not signed in => no button or a disabled button
                    <button
                      disabled
                      style={{
                        padding: '8px 16px',
                        background: '#999',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'not-allowed'
                      }}
                    >
                      Sign up 🤝
                    </button>
                  )}

                  {/* Delete if user is the event owner */}
                  {user && ev.postedBy === user.uid && (
                    <button
                      onClick={() => handleDelete(ev.id)}
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

              {/* Event Info */}
              <div style={{ color: '#666666', marginBottom: '10px' }}>
                📅 {new Date(ev.date).toLocaleDateString()} at {formatTime(ev.time)} |{' '}
                📍 {ev.location} | 🏷️ {ev.category} |{' '}
                👥 {ev.attendees?.length || 0} joining
              </div>

              {ev.description && (
                <p style={{ color: '#666666', margin: '10px 0' }}>
                  {ev.description}
                </p>
              )}

              {/* Attendees List */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                {ev.attendees?.map((attendee, index) => {
                  // If older events used just string UIDs, handle that:
                  if (typeof attendee === "string") {
                    return (
                      <span
                        key={`${attendee}-${index}`}
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
                    );
                  } else {
                    // { uid, name }
                    return (
                      <span
                        key={attendee.uid}
                        style={{
                          padding: '4px 8px',
                          background: '#e6f0ff',
                          color: '#4444ff',
                          borderRadius: '100px',
                          fontSize: '14px'
                        }}
                      >
                        {attendee.name || attendee.uid}
                      </span>
                    );
                  }
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div
          style={{
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
          }}
        >
          <div
            style={{
              background: 'white',
              padding: '20px',
              borderRadius: '8px',
              maxWidth: '400px',
              width: '100%'
            }}
          >
            <h3 style={{ marginTop: 0 }}>{showConfirmModal.title}</h3>
            <p>{showConfirmModal.message}</p>
            <div
              style={{
                display: 'flex',
                gap: '10px',
                justifyContent: 'flex-end'
              }}
            >
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
        <div
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(0,0,0,0.8)',
            color: 'white',
            padding: '20px',
            borderRadius: '8px',
            zIndex: 1000
          }}
        >
          Loading...
        </div>
      )}

      {/* Success Message */}
      {successMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            background: '#44bb44',
            color: 'white',
            padding: '10px 20px',
            borderRadius: '4px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            zIndex: 1000
          }}
        >
          {successMessage}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            background: '#ff4444',
            color: 'white',
            padding: '10px 20px',
            borderRadius: '4px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            zIndex: 1000
          }}
        >
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

export default Events;
