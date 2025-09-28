import { LOCAL_KEYS } from "../lib/types";
import type { ServerSubscription, ServerScript } from "../lib/types";

export const AUTS_SUBSCRIPTIONS_KEY = LOCAL_KEYS.SUBSCRIPTIONS;

export interface SubscriptionResponse {
  license: {
    key: string;
    status: string;
    expiresAt?: string;
    note: string;
  };
  scripts: Array<{
    ID: string;
    Version: string;
    Code: string;
    Removed: boolean;
    LicenseKey?: string;
  }>;
}

/**
 * Get all subscriptions from local storage
 */
export async function getAllSubscriptions(): Promise<ServerSubscription[]> {
  try {
    const data = await chrome.storage.local.get(AUTS_SUBSCRIPTIONS_KEY);
    const value = data[AUTS_SUBSCRIPTIONS_KEY];
    return Array.isArray(value) ? (value as ServerSubscription[]) : [];
  } catch (error) {
    console.error("Error getting subscriptions:", error);
    return [];
  }
}

/**
 * Save all subscriptions to local storage
 */
export async function saveAllSubscriptions(subscriptions: ServerSubscription[]): Promise<void> {
  try {
    await chrome.storage.local.set({ [AUTS_SUBSCRIPTIONS_KEY]: subscriptions });
  } catch (error) {
    console.error("Error saving subscriptions:", error);
  }
}

/**
 * Add a new subscription by fetching from server
 */
export async function addSubscription(subscriptionUrl: string, name?: string): Promise<ServerSubscription> {
  const response = await fetch(subscriptionUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch subscription: ${response.statusText}`);
  }
  
  const data: SubscriptionResponse = await response.json();
  
  // Parse server base from URL
  const url = new URL(subscriptionUrl);
  const serverBase = `${url.protocol}//${url.host}`;
  const licenseKey = url.searchParams.get('license') || '';
  
  // Convert server scripts to our format
  const scripts: ServerScript[] = data.scripts
    .filter(script => !script.Removed)
    .map(script => ({
      id: script.ID,
      version: script.Version,
      code: script.Code,
      enabled: true,
      licenseKey: script.LicenseKey,
    }));

  const subscription: ServerSubscription = {
    id: generateSubscriptionId(),
    name: name || data.license.note || `订阅 ${licenseKey}`,
    enabled: true,
    serverBase,
    licenseKey,
    lastUpdated: Date.now(),
    scripts,
  };

  const subscriptions = await getAllSubscriptions();
  subscriptions.push(subscription);
  await saveAllSubscriptions(subscriptions);
  
  return subscription;
}

/**
 * Update an existing subscription by re-fetching from server
 */
export async function updateSubscription(subscriptionId: string): Promise<ServerSubscription | null> {
  const subscriptions = await getAllSubscriptions();
  const index = subscriptions.findIndex(sub => sub.id === subscriptionId);
  
  if (index === -1) return null;
  
  const existing = subscriptions[index];
  const subscriptionUrl = `${existing.serverBase}/subscription?license=${existing.licenseKey}`;
  
  try {
    const response = await fetch(subscriptionUrl);
    if (!response.ok) {
      throw new Error(`Failed to update subscription: ${response.statusText}`);
    }
    
    const data: SubscriptionResponse = await response.json();
    
    // Convert server scripts to our format, preserving enabled state where possible
    const scripts: ServerScript[] = data.scripts
      .filter(script => !script.Removed)
      .map(script => {
        const existingScript = existing.scripts.find(s => s.id === script.ID);
        return {
          id: script.ID,
          version: script.Version,
          code: script.Code,
          enabled: existingScript?.enabled ?? true,
          licenseKey: script.LicenseKey,
        };
      });

    const updatedSubscription: ServerSubscription = {
      ...existing,
      scripts,
      lastUpdated: Date.now(),
    };

    subscriptions[index] = updatedSubscription;
    await saveAllSubscriptions(subscriptions);
    
    return updatedSubscription;
  } catch (error) {
    console.error("Error updating subscription:", error);
    throw error;
  }
}

/**
 * Delete a subscription
 */
export async function deleteSubscription(subscriptionId: string): Promise<void> {
  const subscriptions = await getAllSubscriptions();
  const filtered = subscriptions.filter(sub => sub.id !== subscriptionId);
  await saveAllSubscriptions(filtered);
}

/**
 * Toggle subscription enabled status
 */
export async function toggleSubscription(subscriptionId: string): Promise<ServerSubscription | null> {
  const subscriptions = await getAllSubscriptions();
  const subscription = subscriptions.find(sub => sub.id === subscriptionId);
  
  if (!subscription) return null;

  if (subscription.enabled) {
    // Disabling: remove scripts entirely (no filtering), keep only metadata
    subscription.enabled = false;
    subscription.scripts = [];
    subscription.lastUpdated = Date.now();
    await saveAllSubscriptions(subscriptions);
    return subscription;
  } else {
    // Enabling: flip flag, then fetch fresh scripts from server
    subscription.enabled = true;
    subscription.lastUpdated = Date.now();
    await saveAllSubscriptions(subscriptions);
    try {
      const updated = await updateSubscription(subscriptionId);
      return updated;
    } catch (_e) {
      // On failure keep enabled state but with empty scripts
      return subscription;
    }
  }
}

/**
 * Toggle individual script within a subscription
 */
export async function toggleSubscriptionScript(subscriptionId: string, scriptId: string): Promise<ServerSubscription | null> {
  const subscriptions = await getAllSubscriptions();
  const subscription = subscriptions.find(sub => sub.id === subscriptionId);
  
  if (!subscription) return null;
  
  const script = subscription.scripts.find(s => s.id === scriptId);
  if (script) {
    script.enabled = !script.enabled;
    await saveAllSubscriptions(subscriptions);
  }
  
  return subscription;
}

/**
 * Generate a unique subscription ID
 */
function generateSubscriptionId(): string {
  return "subscription_" + Date.now() + "_" + Math.random().toString(36).substring(2, 11);
}