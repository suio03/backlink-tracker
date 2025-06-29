"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WebsiteExtendedInfo } from "@/types";
import { Save, Edit3, Trash2, Mail, Globe, FileText } from "lucide-react";

interface WebsiteInfoFormProps {
  websiteId: number;
  websiteName: string;
}

export function WebsiteInfoForm({ websiteId, websiteName }: WebsiteInfoFormProps) {
  const [websiteInfo, setWebsiteInfo] = useState<WebsiteExtendedInfo | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    supportEmail: '',
    title: '',
    description: '',
    url: ''
  });

  // Fetch existing website info
  useEffect(() => {
    const fetchWebsiteInfo = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/website-info/${websiteId}`);
        const result = await response.json();
        
        if (result.success && result.data) {
          setWebsiteInfo(result.data);
          setFormData({
            supportEmail: result.data.supportEmail || '',
            title: result.data.title || '',
            description: result.data.description || '',
            url: result.data.url || ''
          });
        } else {
          // No existing data, start in editing mode for new entry
          setWebsiteInfo(null);
          setIsEditing(true);
        }
      } catch (error) {
        console.error('Error fetching website info:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWebsiteInfo();
  }, [websiteId]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      
      const method = websiteInfo ? 'PUT' : 'POST';
      const url = websiteInfo ? `/api/website-info/${websiteId}` : '/api/website-info';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          websiteId,
          ...formData
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Update local state
        const updatedInfo: WebsiteExtendedInfo = {
          websiteId,
          ...formData,
          lastUpdated: new Date().toISOString()
        };
        setWebsiteInfo(updatedInfo);
        setIsEditing(false);
      } else {
        alert(`Error: ${result.message}`);
      }
    } catch (error) {
      console.error('Error saving website info:', error);
      alert('Failed to save website information');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!websiteInfo) return;
    
    if (!confirm('Are you sure you want to delete this website information?')) {
      return;
    }

    try {
      const response = await fetch(`/api/website-info/${websiteId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        setWebsiteInfo(null);
        setFormData({
          supportEmail: '',
          title: '',
          description: '',
          url: ''
        });
        setIsEditing(true); // Allow creating new info
      } else {
        alert(`Error: ${result.message}`);
      }
    } catch (error) {
      console.error('Error deleting website info:', error);
      alert('Failed to delete website information');
    }
  };

  const handleCancel = () => {
    if (websiteInfo) {
      // Revert to saved data
      setFormData({
        supportEmail: websiteInfo.supportEmail || '',
        title: websiteInfo.title || '',
        description: websiteInfo.description || '',
        url: websiteInfo.url || ''
      });
      setIsEditing(false);
    } else {
      // Clear form for new entry
      setFormData({
        supportEmail: '',
        title: '',
        description: '',
        url: ''
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Website Information
          </CardTitle>
          <CardDescription>Loading website details...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-8 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-8 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Website Information
        </CardTitle>
        <CardDescription>
          Extended information for {websiteName}
          {websiteInfo && (
            <span className="text-xs text-gray-500 block mt-1">
              Last updated: {new Date(websiteInfo.lastUpdated).toLocaleDateString()}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Support Email */}
        <div>
          <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-2">
            <Mail className="h-4 w-4" />
            Support Email
          </label>
          {isEditing ? (
            <Input
              type="email"
              value={formData.supportEmail}
              onChange={(e) => handleInputChange('supportEmail', e.target.value)}
              placeholder="support@example.com"
            />
          ) : (
            <div className="text-sm text-gray-600 p-2 bg-gray-50 rounded">
              {websiteInfo?.supportEmail || 'Not specified'}
            </div>
          )}
        </div>

        {/* Title */}
        <div>
          <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4" />
            Title
          </label>
          {isEditing ? (
            <Input
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder="Website Title"
            />
          ) : (
            <div className="text-sm text-gray-600 p-2 bg-gray-50 rounded">
              {websiteInfo?.title || 'Not specified'}
            </div>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4" />
            Description
          </label>
          {isEditing ? (
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Brief description of the website..."
              className="w-full p-2 border border-gray-300 rounded-md resize-none"
              rows={3}
            />
          ) : (
            <div className="text-sm text-gray-600 p-2 bg-gray-50 rounded min-h-[60px]">
              {websiteInfo?.description || 'Not specified'}
            </div>
          )}
        </div>

        {/* URL */}
        <div>
          <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-2">
            <Globe className="h-4 w-4" />
            Website URL
          </label>
          {isEditing ? (
            <Input
              type="url"
              value={formData.url}
              onChange={(e) => handleInputChange('url', e.target.value)}
              placeholder="https://example.com"
            />
          ) : (
            <div className="text-sm text-gray-600 p-2 bg-gray-50 rounded">
              {websiteInfo?.url ? (
                <a 
                  href={websiteInfo.url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-blue-600 hover:underline"
                >
                  {websiteInfo.url}
                </a>
              ) : (
                'Not specified'
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4 border-t">
          {isEditing ? (
            <>
              <Button 
                onClick={handleSave} 
                disabled={isSaving}
                size="sm"
              >
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
              <Button 
                onClick={handleCancel} 
                variant="outline" 
                size="sm"
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button 
                onClick={() => setIsEditing(true)} 
                variant="outline" 
                size="sm"
              >
                <Edit3 className="h-4 w-4 mr-2" />
                Edit
              </Button>
              {websiteInfo && (
                <Button 
                  onClick={handleDelete} 
                  variant="outline" 
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 