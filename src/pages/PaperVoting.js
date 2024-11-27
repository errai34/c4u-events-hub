import React, { useState, useEffect } from 'react';
import { getFirestore, collection, addDoc, onSnapshot, updateDoc, doc, deleteDoc, increment } from 'firebase/firestore';

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
  const db = getFirestore();

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
    const fetchPapers = async () => {
      try {
        const response = await fetch(GOOGLE_SCRIPT_URL);
        const data = await response.json();
        
        const papersWithMetadata = await Promise.all(data.map(async (paper) => {
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

  const handleVote = async (paperId) => {
    try {
      const paperRef = doc(db, 'paperVotes', paperId);
      await updateDoc(paperRef, {
        votes: increment(1)
      });
    } catch (error) {
      console.error('Error voting:', error);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Paper Voting</h2>
      {loading ? (
        <p>Loading papers...</p>
      ) : papers.length === 0 ? (
        <p>No papers available for voting</p>
      ) : (
        <div className="grid gap-6">
          {papers.sort((a, b) => b.votes - a.votes).map((paper) => (
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
                  className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100"
                >
                  <span>👍</span>
                  <span>{paper.votes || 0}</span>
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
