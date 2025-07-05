"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { WebsiteGrid } from "@/components/website-grid";
import { Navigation } from "@/components/navigation";
import { WebsiteWithStats } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, Check } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const [websites, setWebsites] = useState<WebsiteWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  
  useEffect(() => {
    async function fetchWebsites() {
      try {
        setLoading(true);
        const response = await fetch('/api/websites');
        const result = await response.json();
        
        if (result.success) {
          setWebsites(result.data);
        } else {
          setError(result.message || 'Failed to fetch websites');
        }
      } catch (err) {
        console.error('Error fetching websites:', err);
        setError('Failed to connect to the server');
      } finally {
        setLoading(false);
      }
    }

    fetchWebsites();
  }, []);

  const handleCopy = async (text: string, fieldId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldId);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedField(fieldId);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };
  
  const handleWebsiteSelect = (website: WebsiteWithStats) => {
    console.log("Selected website:", website.domain);
    // Navigate to resource management page
    router.push(`/website/${website.id}`);
  };

  // Quick reference data
  const quickReferenceData = [
    {
      id: 'tango',
      url: 'https://tangogameunlimited.app/',
      name: 'tango game unlimited',
      email: 'tangogame@support.app'
    },
    {
      id: 'zip',
      url: 'https://zipgame.net/',
      name: 'zip game',
      email: 'zipgame@support.net'
    }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading your websites...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="text-red-600 text-lg font-semibold mb-2">Error</div>
              <p className="text-gray-600">{error}</p>
              <button 
                onClick={() => window.location.reload()} 
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        {/* Quick Reference Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Quick Reference</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {quickReferenceData.map((item) => (
                <div key={item.id} className="space-y-3">
                  <h3 className="font-medium text-gray-900 capitalize">{item.name}</h3>
                  
                  {/* URL Field */}
                  <div className="relative">
                    <Input 
                      value={item.url}
                      readOnly
                      className="pr-10 cursor-pointer"
                      onClick={() => handleCopy(item.url, `${item.id}-url`)}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                      onClick={() => handleCopy(item.url, `${item.id}-url`)}
                    >
                      {copiedField === `${item.id}-url` ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4 text-gray-500" />
                      )}
                    </Button>
                  </div>

                  {/* Name Field */}
                  <div className="relative">
                    <Input 
                      value={item.name}
                      readOnly
                      className="pr-10 cursor-pointer"
                      onClick={() => handleCopy(item.name, `${item.id}-name`)}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                      onClick={() => handleCopy(item.name, `${item.id}-name`)}
                    >
                      {copiedField === `${item.id}-name` ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4 text-gray-500" />
                      )}
                    </Button>
                  </div>

                  {/* Email Field */}
                  <div className="relative">
                    <Input 
                      value={item.email}
                      readOnly
                      className="pr-10 cursor-pointer"
                      onClick={() => handleCopy(item.email, `${item.id}-email`)}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                      onClick={() => handleCopy(item.email, `${item.id}-email`)}
                    >
                      {copiedField === `${item.id}-email` ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4 text-gray-500" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <WebsiteGrid 
          websites={websites}
          onWebsiteSelect={handleWebsiteSelect}
        />
      </div>
    </div>
  );
}
