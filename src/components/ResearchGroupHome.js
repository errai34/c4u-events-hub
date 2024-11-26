import React from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { Calendar, BookOpen, Vote } from 'lucide-react';

const ResearchGroupHome = () => {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 text-gray-900">Stanford C4U Launchpad</h1>
          <p className="text-gray-600">Welcome to Stanford C4U home page. This is where you will find upcoming events, and suggest/vote on papers.</p>
        </div>

        <Tabs.Root defaultValue="events" className="w-full">
          <Tabs.List className="flex space-x-1 border-b border-gray-200 mb-6">
            <Tabs.Trigger 
              className="group flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300 data-[state=active]:border-b-2 data-[state=active]:border-blue-500 data-[state=active]:text-blue-600 outline-none cursor-pointer"
              value="events"
            >
              <Calendar className="w-4 h-4" />
              <span>Events</span>
            </Tabs.Trigger>
            <Tabs.Trigger 
              className="group flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300 data-[state=active]:border-b-2 data-[state=active]:border-blue-500 data-[state=active]:text-blue-600 outline-none cursor-pointer"
              value="papers"
            >
              <BookOpen className="w-4 h-4" />
              <span>Paper Suggestions</span>
            </Tabs.Trigger>
            <Tabs.Trigger 
              className="group flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300 data-[state=active]:border-b-2 data-[state=active]:border-blue-500 data-[state=active]:text-blue-600 outline-none cursor-pointer"
              value="voting"
            >
              <Vote className="w-4 h-4" />
              <span>Paper Voting</span>
            </Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content 
            value="events" 
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
          >
            <h2 className="text-xl font-semibold mb-4 text-gray-900">Upcoming Events</h2>
            <iframe 
              src="https://c4u-events-hub.vercel.app"
              className="w-full h-[800px] border-0"
              title="Events Calendar"
            />
          </Tabs.Content>

          <Tabs.Content 
            value="papers"
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
          >
            <h2 className="text-xl font-semibold mb-4 text-gray-900">Paper Suggestions</h2>
            <p className="text-gray-600">Coming soon: Submit and browse paper suggestions</p>
          </Tabs.Content>

          <Tabs.Content 
            value="voting"
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
          >
            <h2 className="text-xl font-semibold mb-4 text-gray-900">Paper Voting</h2>
            <p className="text-gray-600">Coming soon: Vote on papers for discussion</p>
          </Tabs.Content>
        </Tabs.Root>
      </div>
    </div>
  );
};

export default ResearchGroupHome;
