// src/components/ResearchGroupHome.js
import React, { useContext } from 'react';
import PaperVoting from '../pages/PaperVoting';
import * as Tabs from '@radix-ui/react-tabs';
import { Calendar, BookOpen, Vote, Check } from 'lucide-react';

// AuthContext provides { user, signIn, signOutUser }
import { AuthContext } from '../context/AuthContext';

const ResearchGroupHome = () => {
  const { user, signIn, signOutUser } = useContext(AuthContext);

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto p-6">
        
        {/* Header with sign-in / sign-out */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2 text-gray-900">Stanford C4U Launchpad</h1>
            <p className="text-gray-600">
              Welcome to Stanford C4U home page. This is where you will find upcoming events,
              and suggest/vote on papers.
            </p>
          </div>
          
          <div>
            {user ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-700">
                  Hello, {user.displayName || user.email}!
                </span>
                <button
                  onClick={signOutUser}
                  className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={signIn}
                className="px-6 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
              >
                Sign In with Google
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <Tabs.Root defaultValue="events" className="w-full">
          <Tabs.List className="flex space-x-1 border-b border-gray-200 mb-6">
            <Tabs.Trigger
              className="group flex items-center gap-2 px-4 py-2 text-sm font-medium 
                         text-gray-500 hover:text-gray-700 hover:border-gray-300 
                         data-[state=active]:border-b-2 data-[state=active]:border-blue-500 
                         data-[state=active]:text-blue-600 outline-none cursor-pointer"
              value="events"
            >
              <Calendar className="w-4 h-4" />
              <span>Events</span>
            </Tabs.Trigger>
            <Tabs.Trigger
              className="group flex items-center gap-2 px-4 py-2 text-sm font-medium 
                         text-gray-500 hover:text-gray-700 hover:border-gray-300 
                         data-[state=active]:border-b-2 data-[state=active]:border-blue-500 
                         data-[state=active]:text-blue-600 outline-none cursor-pointer"
              value="papers"
            >
              <BookOpen className="w-4 h-4" />
              <span>Paper Suggestions</span>
            </Tabs.Trigger>
            <Tabs.Trigger
              className="group flex items-center gap-2 px-4 py-2 text-sm font-medium 
                         text-gray-500 hover:text-gray-700 hover:border-gray-300 
                         data-[state=active]:border-b-2 data-[state=active]:border-blue-500 
                         data-[state=active]:text-blue-600 outline-none cursor-pointer"
              value="voting"
            >
              <Vote className="w-4 h-4" />
              <span>Paper Voting</span>
            </Tabs.Trigger>
            <Tabs.Trigger
              className="group flex items-center gap-2 px-4 py-2 text-sm font-medium 
                         text-gray-500 hover:text-gray-700 hover:border-gray-300 
                         data-[state=active]:border-b-2 data-[state=active]:border-blue-500 
                         data-[state=active]:text-blue-600 outline-none cursor-pointer"
              value="presented"
            >
              <Check className="w-4 h-4" />
              <span>Presented Papers</span>
            </Tabs.Trigger>
          </Tabs.List>

          {/* Events Tab */}
          <Tabs.Content
            value="events"
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
          >
            <h2 className="text-xl font-semibold mb-4 text-gray-900">Upcoming Events</h2>
            <iframe
              src="/events"
              className="w-full h-[800px] border-0"
              title="Events Calendar"
            />
          </Tabs.Content>

          {/* Paper Suggestions Tab */}
          <Tabs.Content
            value="papers"
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
          >
            <h2 className="text-xl font-semibold mb-4 text-gray-900">Paper Suggestions</h2>
            <iframe
              src="https://forms.gle/YLN1pSxp6Sdu9nCT8"
              className="w-full h-[800px] border-0"
              title="Paper Suggestions Form"
            />
          </Tabs.Content>

          {/* Paper Voting Tab */}
          <Tabs.Content
            value="voting"
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
          >
            <PaperVoting />
          </Tabs.Content>

          {/* Presented Papers Tab */}
          <Tabs.Content
            value="presented"
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
          >
            <PaperVoting presentedOnly={true} />
          </Tabs.Content>
        </Tabs.Root>
      </div>
    </div>
  );
};

export default ResearchGroupHome;
