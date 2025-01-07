// src/pages/PaperVoting.js
import React, { useState, useEffect, useContext } from 'react';
import { collection, doc, updateDoc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';                // Shared Firestore instance
import { AuthContext } from '../context/AuthContext'; // Contains { user, signIn }

// External script & proxy endpoints
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbymaihSFzJhauKZKUZltxo_kltEwKaIV3yp8rq_yJzMklUIg1KWUPtObS1ZEZ4WULaH/exec';
const CORS_PROXY = 'https://corsproxy.io/?';

// Utility functions to parse metadata from arXiv/OpenReview/Generic
const extractArxivId = (url) => {
  const match = url.match(/arxiv\.org\/(?:abs|pdf)\/(\d+\.\d+)/);
  return match ? match[1] : null;
};

const extractOpenReviewId = (url) => {
  const match = url.match(/openreview\.net\/forum\?id=([^&]+)/);
  return match ? match[1] : null;
};

const formatAuthors = (authors) => {
  if (!authors || authors.length === 0) return '';
  if (authors.length <= 3) return authors.join(', ');
  return `${authors.slice(0, 3).join(', ')} et al.`;
};

const PaperVoting = ({ presentedOnly = false }) => {
  // We get the current user and signIn function from AuthContext
  const { user, signIn } = useContext(AuthContext);

  // Local state
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [votes, setVotes] = useState({});       // { [paperId]: numberOfVotes }
  const [userVotes, setUserVotes] = useState({}); // { [paperId]: true } for papers user voted for

  // Fetch the user's votes from Firestore whenever user changes
  useEffect(() => {
    if (!user) {
      setUserVotes({});
      return;
    }

    const userVotesRef = doc(db, 'userVotes', user.uid);
    const unsubscribe = onSnapshot(userVotesRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setUserVotes(data.votes || {});
      } else {
        setUserVotes({});
      }
    });

    return () => unsubscribe();
  }, [user]);

  // Listen for vote counts in 'paperVotes' collection
  useEffect(() => {
    const votesRef = collection(db, 'paperVotes');
    const unsubscribe = onSnapshot(votesRef, (snapshot) => {
      const votesData = {};
      snapshot.forEach((docSnap) => {
        const docData = docSnap.data();
        votesData[docSnap.id] = docData.votes || 0;
      });
      setVotes(votesData);
    });

    return () => unsubscribe();
  }, []);

  // Fetch paper suggestions from your Google Sheets script, then fetch metadata
  useEffect(() => {
    const fetchPapers = async () => {
      try {
        const response = await fetch(GOOGLE_SCRIPT_URL);
        const data = await response.json();

        // For each paper, ensure it exists in 'paperVotes' with a non-negative vote count
        // Also fetch metadata (arXiv, OpenReview, or generic site)
        const papersWithMetadata = await Promise.all(
          data.map(async (paper) => {
            // Ensure Firestore has an entry for this paper's vote count
            const voteRef = doc(db, 'paperVotes', paper.id);
            const voteDoc = await getDoc(voteRef);

            if (!voteDoc.exists()) {
              await setDoc(voteRef, {
                votes: 0,
                initializedAt: new Date().toISOString()
              });
            } else {
              // If votes is not a valid number, reset to 0
              const currentVotes = voteDoc.data().votes;
              if (typeof currentVotes !== 'number' || currentVotes < 0) {
                await updateDoc(voteRef, { votes: 0 });
              }
            }

            // Attempt to fetch metadata from known sources
            if (!paper.url.startsWith('http')) {
              // If it's not a valid URL, just store title as the url
              return { ...paper, title: paper.url, authors: null };
            }

            if (paper.url.includes('arxiv.org')) {
              const arxivId = extractArxivId(paper.url);
              if (arxivId) {
                const meta = await fetchArxivMetadata(arxivId);
                return { ...paper, ...meta };
              }
            }

            if (paper.url.includes('openreview.net')) {
              const openReviewId = extractOpenReviewId(paper.url);
              if (openReviewId) {
                const meta = await fetchOpenReviewMetadata(openReviewId);
                return { ...paper, ...meta };
              }
            }

            // Otherwise, do a generic fetch
            const genericMeta = await fetchGenericMetadata(paper.url);
            return { ...paper, ...genericMeta };
          })
        );

        setPapers(papersWithMetadata);
      } catch (error) {
        console.error('Error fetching papers:', error);
      }
      setLoading(false);
    };

    fetchPapers();
  }, []);

  // Functions to fetch metadata from different sources
  const fetchArxivMetadata = async (arxivId) => {
    try {
      const response = await fetch(`${CORS_PROXY}https://export.arxiv.org/api/query?id_list=${arxivId}`);
      const text = await response.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(text, 'text/xml');

      const entry = xmlDoc.querySelector('entry');
      const title = entry?.querySelector('title')?.textContent.trim();
      const authorNodes = entry?.querySelectorAll('author > name');
      const authors = Array.from(authorNodes || []).map((node) => node.textContent.trim());

      return { title, authors: formatAuthors(authors) };
    } catch (error) {
      console.error('Error fetching arXiv metadata:', error);
      return { title: null, authors: null };
    }
  };

  const fetchOpenReviewMetadata = async (id) => {
    try {
      const response = await fetch(`${CORS_PROXY}https://api.openreview.net/notes?id=${id}`);
      const data = await response.json();
      if (data.notes?.[0]) {
        const note = data.notes[0];
        return {
          title: note.content.title,
          authors: formatAuthors(note.content.authors)
        };
      }
      return { title: null, authors: null };
    } catch (error) {
      console.error('Error fetching OpenReview metadata:', error);
      return { title: null, authors: null };
    }
  };

  const fetchGenericMetadata = async (url) => {
    try {
      const response = await fetch(`${CORS_PROXY}${url}`);
      const text = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/html');

      const title =
        doc.querySelector('meta[property="og:title"]')?.content ||
        doc.querySelector('meta[name="title"]')?.content ||
        doc.querySelector('title')?.textContent;

      return { title: title?.trim() || null, authors: null };
    } catch (error) {
      console.error('Error fetching generic metadata:', error);
      return { title: null, authors: null };
    }
  };

  // Voting logic
  const handleVote = async (paperId) => {
    if (!user) {
      // If not signed in, trigger sign in
      signIn();
      return;
    }

    try {
      const paperRef = doc(db, 'paperVotes', paperId);
      const userVotesRef = doc(db, 'userVotes', user.uid);

      // Get current vote count
      const paperVoteDoc = await getDoc(paperRef);
      const currentVotes = paperVoteDoc.exists() ? paperVoteDoc.data().votes || 0 : 0;

      if (userVotes[paperId]) {
        // If user already voted for this paper, remove vote
        await updateDoc(paperRef, { votes: Math.max(0, currentVotes - 1) });

        const updatedVotes = { ...userVotes };
        delete updatedVotes[paperId];
        await setDoc(userVotesRef, { votes: updatedVotes });
      } else {
        // Otherwise, add a new vote
        await updateDoc(paperRef, { votes: currentVotes + 1 });
        await setDoc(
          userVotesRef,
          { votes: { ...userVotes, [paperId]: true } },
          { merge: true }
        );
      }
    } catch (error) {
      console.error('Error toggling vote:', error);
    }
  };

  // Filter out or in "presented" papers
  // Sort by votes descending (or by presented date)
  const filteredPapers = papers
    .filter((paper) => {
      const isPaperPresented = paper.presented === true || paper.presented === "true";
      return presentedOnly ? isPaperPresented : !isPaperPresented;
    })
    .sort((a, b) => {
      if (presentedOnly) {
        // For presented papers, sort descending by timestamp
        return new Date(b.timestamp) - new Date(a.timestamp);
      }
      // For unpresented papers, sort by vote count descending
      return (votes[b.id] || 0) - (votes[a.id] || 0);
    });

  // Render
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">
        {presentedOnly ? "Presented Papers" : "Paper Voting"}
      </h2>

      {loading ? (
        <p>Loading papers...</p>
      ) : filteredPapers.length === 0 ? (
        <p>No {presentedOnly ? "presented" : ""} papers available</p>
      ) : (
        <div className="grid gap-6">
          {filteredPapers.map((paper) => (
            <div key={paper.id} className="bg-white rounded-lg shadow p-6 border">
              <div className="flex justify-between items-start">
                <div className="flex-grow pr-6">
                  {paper.title && (
                    <h3 className="text-lg font-bold mb-1">{paper.title}</h3>
                  )}
                  {paper.authors && (
                    <p className="text-sm text-gray-600 mb-2">{paper.authors}</p>
                  )}
                  <p className="text-md mb-2">
                    {paper.url?.startsWith('http') && (
                      <a
                        href={paper.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {paper.url}
                      </a>
                    )}
                  </p>
                  {paper.justification && (
                    <p className="text-gray-600 mb-2">
                      <span className="font-medium">Justification: </span>
                      {paper.justification}
                    </p>
                  )}
                  {paper.presenter && (
                    <p className="text-sm text-gray-500">
                      Suggested presenter(s): {paper.presenter}
                    </p>
                  )}
                </div>

                {/* Only show "Like" button if not presented */}
                {!presentedOnly && (
                  <button
                    onClick={() => handleVote(paper.id)}
                    className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full ${
                      userVotes[paper.id]
                        ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                        : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                    }`}
                  >
                    <span>👍</span>
                    <span>{votes[paper.id] || 0}</span>
                  </button>
                )}
              </div>

              {/* If it's a presented paper, show presentation date */}
              {presentedOnly && paper.timestamp && (
                <div className="mt-2 text-sm text-gray-500">
                  Presented on: {new Date(paper.timestamp).toLocaleDateString()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PaperVoting;
