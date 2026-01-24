import React from "react";

// Regex to detect URLs (http, https)
const urlRegex = /(https?:\/\/[^\s]+)/g;

/**
 * Converts plain text to React elements with clickable links
 * @param {string} text - The message text to process
 * @returns {React.ReactNode[]} - Array of text and link elements
 */
export const linkifyText = (text) => {
    if (!text) return "";

    // Split text by URLs, preserving the URLs as separate parts
    const parts = text.split(urlRegex);

    return parts.map((part, index) => {
        // Check if this part is a URL
        if (part.match(urlRegex)) {
            return (
                <a
                    key={index}
                    href={part}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 underline break-all"
                    onClick={(e) => e.stopPropagation()}
                >
                    {part}
                </a>
            );
        }
        return part;
    });
};
