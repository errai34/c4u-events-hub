import React, { useState, useEffect } from 'react';
import { collection, doc, updateDoc, increment, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { signInWithPopup } from 'firebase/auth';
import { db, auth, googleProvider } from '../firebase';

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxxXQo_0Ntl_ooK93OF25w4BryPTyb8MtaixtJqQOEEvSdjSo_jGYZN9V3Xa8grjvR2/exec';
const CORS_PROXY = 'https://corsproxy.io/?';

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

const PaperVoting = () => {
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [votes, setVotes] = useState({});
  const [userVotes, setUserVotes] = useState({});
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user);
      if (user) {
        // Fetch user's votes
        const userVotesRef = doc(db, 'userVotes', user.uid);
        onSnapshot(userVotesRef, (doc) => {
          setUserVotes(doc.exists() ? doc.data().votes || {} : {});
        });
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchArxivMetadata = async (arxivId) => {
    try {
      const response = await fetch(`${CORS_PROXY}https://export.arxiv.org/api/query?id_list=${arxivId}`);
      const text = await response.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(text, 'text/xml');
      
      const entry = xmlDoc.querySelector('entry');
      const title = entry?.querySelector('title')?.textContent.trim();
      const authorNodes = entry?.querySelectorAll('author > name');
      const authors = Array.from(authorNodes || []).map(node => node.textContent.trim());
      
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
      
      const title = doc.querySelector('meta[property="og:title"]')?.content ||
                    doc.querySelector('meta[name="title"]')?.content ||
                    doc.querySelector('title')?.textContent;
      
      return { title: title?.trim() || null, authors: null };
    } catch (error) {
      console.error('Error fetching generic metadata:', error);
      return { title: null, authors: null };
    }
  };

  useEffect(() => {
    const votesRef = collection(db, 'paperVotes');
    const unsubscribe = onSnapshot(votesRef, (snapshot) => {
      const votesData = {};
      snapshot.forEach((doc) => {
        votesData[doc.id] = doc.data().votes || 0;
      });
      setVotes(votesData);
    });

    return () => unsubscribe();
  }, []);
      
  useEffect(() => {
    const fetchPapers = async () => {
      try {
        const response = await fetch(GOOGLE_SCRIPT_URL);
        const data = await response.json();
        
        const papersWithMetadata = await Promise.all(data.map(async (paper) => {
          const voteRef = doc(db, 'paperVotes', paper.id);
          const voteDoc = await getDoc(voteRef);
          if (!voteDoc.exists()) {
            await setDoc(voteRef, { votes: 0 });
          }
	    
          if (!paper.url.startsWith('http')) {
            return { ...paper, title: paper.url, authors: null };
          }

          if (paper.url.includes('arxiv.org')) {
            const arxivId = extractArxivId(paper.url);
            if (arxivId) {
              return { ...paper, ...(await fetchArxivMetadata(arxivId)) };
            }
          }

          if (paper.url.includes('openreview.net')) {
            const openReviewId = extractOpenReviewId(paper.url);
            if (openReviewId) {
              return { ...paper, ...(await fetchOpenReviewMetadata(openReviewId)) };
            }
          }

          return { ...paper, ...(await fetchGenericMetadata(paper.url)) };
        }));
        
        setPapers(papersWithMetadata);
      } catch (error) {
        console.error('Error fetching papers:', error);
      }
      setLoading(false);
    };

    fetchPapers();
  }, []);

  const handleSignIn = async () => {
  try {
    console.log('Starting sign in process...');
    const result = await signInWithPopup(auth, googleProvider);
    console.log('Sign in successful:', result.user.email);
  } catch (error) {
    console.error('Authentication error:', error);
    if (error.code === 'auth/popup-closed-by-user') {
      console.log('User closed the popup');
    } else if (error.code === 'auth/unauthorized-domain') {
      console.error('This domain is not authorized for OAuth operations');
    }
  }
  };
      
  const handleVote = async (paperId) => {
    if (!user) {
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (error) {
            console.error('Error signing in:', error);
            return;
        }
    }

    try {
        const paperRef = doc(db, 'paperVotes', paperId);
        const userVotesRef = doc(db, 'userVotes', user.uid);
        
        if (userVotes[paperId]) {
            // Remove vote
            await updateDoc(paperRef, {
                votes: increment(-1)
            });
            
            // Remove from user's votes
            const updatedVotes = { ...userVotes };
            delete updatedVotes[paperId];
            await setDoc(userVotesRef, {
                votes: updatedVotes
            }, { merge: true });
        } else {
            // Add vote
            await updateDoc(paperRef, {
                votes: increment(1)
            });
            
            // Add to user's votes
            await setDoc(userVotesRef, {
                votes: { ...userVotes, [paperId]: true }
            }, { merge: true });
        }
    } catch (error) {
        console.error('Error toggling vote:', error);
    }
  };

  const renderVoteButton = (paper) => {
    if (!user) {
      return (
        <button
          onClick={() => handleVote(paper.id)}
          className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100"
        >
          <span>👍</span>
          <span>{votes[paper.id] || 0}</span>
        </button>
      );
    }

  const hasVoted = userVotes[paper.id];
    return (
      <button
        onClick={() => handleVote(paper.id)}
        disabled={hasVoted}
        className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full ${
          hasVoted 
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
            : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
        }`}
      >
        <span>{hasVoted ? '✓' : '👍'}</span>
        <span>{votes[paper.id] || 0}</span>
      </button>
    );
  };

return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Paper Voting</h2>
        {user ? (
          <div className="text-sm text-gray-600">
            Signed in as {user.email}
          </div>
        ) : (
          <button
            onClick={() => signInWithPopup(auth, googleProvider)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Sign in to vote
          </button>
        )}
      </div>
      {loading ? (
        <p>Loading papers...</p>
      ) : papers.length === 0 ? (
        <p>No papers available for voting</p>
      ) : (
        <div className="grid gap-6">
          {papers.sort((a, b) => (votes[b.id] || 0) - (votes[a.id] || 0)).map((paper) => (
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
                    {paper.url.startsWith('http') && (
                      <a href={paper.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        {paper.url}
                      </a>
                    )}
                  </p>
                  <p className="text-gray-600 mb-2">
                    <span className="font-medium">Justification: </span>
                    {paper.justification}
                  </p>
                  <p className="text-sm text-gray-500">Suggested presenter(s): {paper.presenter}</p>
                  </div>
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
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
  };
      
export default PaperVoting;
