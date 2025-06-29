import fs from 'fs';
import path from 'path';
import { WebsiteExtendedInfo } from '@/types';

const DATA_FILE_PATH = path.join(process.cwd(), 'data', 'website-info.json');

interface WebsiteInfoData {
  websites: WebsiteExtendedInfo[];
}

// Initialize the data file if it doesn't exist
function ensureDataFile(): void {
  try {
    if (!fs.existsSync(DATA_FILE_PATH)) {
      const initialData: WebsiteInfoData = { websites: [] };
      fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(initialData, null, 2));
    }
  } catch (error) {
    console.error('Error ensuring data file:', error);
  }
}

// Read all website extended info
export function getAllWebsiteInfo(): WebsiteExtendedInfo[] {
  try {
    ensureDataFile();
    const fileContent = fs.readFileSync(DATA_FILE_PATH, 'utf-8');
    const data: WebsiteInfoData = JSON.parse(fileContent);
    return data.websites;
  } catch (error) {
    console.error('Error reading website info:', error);
    return [];
  }
}

// Get extended info for a specific website
export function getWebsiteInfo(websiteId: number): WebsiteExtendedInfo | null {
  try {
    const allInfo = getAllWebsiteInfo();
    return allInfo.find(info => info.websiteId === websiteId) || null;
  } catch (error) {
    console.error('Error getting website info:', error);
    return null;
  }
}

// Create or update website extended info
export function saveWebsiteInfo(websiteInfo: Omit<WebsiteExtendedInfo, 'lastUpdated'>): boolean {
  try {
    ensureDataFile();
    const allInfo = getAllWebsiteInfo();
    
    const updatedInfo: WebsiteExtendedInfo = {
      ...websiteInfo,
      lastUpdated: new Date().toISOString()
    };
    
    // Find existing entry or add new one
    const existingIndex = allInfo.findIndex(info => info.websiteId === websiteInfo.websiteId);
    
    if (existingIndex >= 0) {
      // Update existing
      allInfo[existingIndex] = updatedInfo;
    } else {
      // Add new
      allInfo.push(updatedInfo);
    }
    
    const data: WebsiteInfoData = { websites: allInfo };
    fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(data, null, 2));
    
    return true;
  } catch (error) {
    console.error('Error saving website info:', error);
    return false;
  }
}

// Delete website extended info
export function deleteWebsiteInfo(websiteId: number): boolean {
  try {
    ensureDataFile();
    const allInfo = getAllWebsiteInfo();
    
    const filteredInfo = allInfo.filter(info => info.websiteId !== websiteId);
    
    const data: WebsiteInfoData = { websites: filteredInfo };
    fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(data, null, 2));
    
    return true;
  } catch (error) {
    console.error('Error deleting website info:', error);
    return false;
  }
}

// Batch operations
export function bulkSaveWebsiteInfo(websiteInfoList: Omit<WebsiteExtendedInfo, 'lastUpdated'>[]): boolean {
  try {
    ensureDataFile();
    const allInfo = getAllWebsiteInfo();
    
    // Update or add each website info
    websiteInfoList.forEach(websiteInfo => {
      const updatedInfo: WebsiteExtendedInfo = {
        ...websiteInfo,
        lastUpdated: new Date().toISOString()
      };
      
      const existingIndex = allInfo.findIndex(info => info.websiteId === websiteInfo.websiteId);
      
      if (existingIndex >= 0) {
        allInfo[existingIndex] = updatedInfo;
      } else {
        allInfo.push(updatedInfo);
      }
    });
    
    const data: WebsiteInfoData = { websites: allInfo };
    fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(data, null, 2));
    
    return true;
  } catch (error) {
    console.error('Error bulk saving website info:', error);
    return false;
  }
} 