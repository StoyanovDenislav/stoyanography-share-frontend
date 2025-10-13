'use client';

import { useState } from 'react';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';

interface ClientRegistrationProps {
  onSuccess: (token: string, clientInfo: any) => void;
}

const API_BASE_URL = 'http://localhost:9001/api';

export default function ClientRegistration({ onSuccess }: ClientRegistrationProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [credentials, setCredentials] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast.error('Please enter your email address');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/client/generate-credentials`, {
        email: email.trim()
      });

      if (response.data.success) {
        setCredentials(response.data.credentials);
        toast.success('Credentials generated successfully!');
        
        // Wait a moment to show the credentials before proceeding
        setTimeout(() => {
          onSuccess(response.data.token, response.data.credentials);
        }, 3000);
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      const message = error.response?.data?.message || 'Failed to generate credentials';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${type} copied to clipboard!`);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <Toaster position="top-right" />
      
      <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
        Get Your Photo Sharing Credentials
      </h2>

      {!credentials ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your.email@example.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            <p className="text-sm text-gray-500 mt-1">
              We'll generate secure credentials for you automatically
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating...
              </span>
            ) : (
              'Generate Credentials'
            )}
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-green-800 mb-3">
              🎉 Your credentials have been generated!
            </h3>
            <p className="text-green-700 text-sm mb-4">
              <strong>Important:</strong> Save these credentials securely. The password will not be shown again.
            </p>
            
            <div className="space-y-3">
              <div className="bg-white rounded-lg p-3 border">
                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <div className="flex items-center justify-between">
                  <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                    {credentials.username}
                  </code>
                  <button
                    onClick={() => copyToClipboard(credentials.username, 'Username')}
                    className="ml-2 text-blue-600 hover:text-blue-800 text-sm"
                  >
                    📋 Copy
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-lg p-3 border">
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <div className="flex items-center justify-between">
                  <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono break-all">
                    {credentials.password}
                  </code>
                  <button
                    onClick={() => copyToClipboard(credentials.password, 'Password')}
                    className="ml-2 text-blue-600 hover:text-blue-800 text-sm"
                  >
                    📋 Copy
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-lg p-3 border">
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <div className="flex items-center justify-between">
                  <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                    {credentials.email}
                  </code>
                  <button
                    onClick={() => copyToClipboard(credentials.email, 'Email')}
                    className="ml-2 text-blue-600 hover:text-blue-800 text-sm"
                  >
                    📋 Copy
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-800 text-sm">
                ⚠️ Redirecting to your photo gallery in a few seconds...
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
