"use client";

import React, { useState, useEffect, useRef } from "react";
import styles from "./CustomDropdown.module.css";

interface CustomDropdownProps {
  selectedLocation: string;
  onChange: (value: string) => void;
  locationsList: string[];
}

export default function CustomDropdown({
  selectedLocation,
  onChange,
  locationsList,
}: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filteredLocations, setFilteredLocations] = useState<string[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter locations on search query change
  useEffect(() => {
    const query = search.toLowerCase();
    const filtered = locationsList.filter((loc) =>
      loc.toLowerCase().includes(query)
    );
    setFilteredLocations(filtered);
  }, [search, locationsList]);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSelect = (loc: string) => {
    onChange(loc);
    setIsOpen(false);
    setSearch("");
  };

  return (
    <div className={styles.dropdownContainer} ref={dropdownRef}>
      <label className={styles.dropdownLabel}>Bengaluru Location</label>
      
      <div 
        className={`${styles.dropdownTrigger} ${isOpen ? styles.active : ""}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={selectedLocation ? styles.selectedVal : styles.placeholderVal}>
          {selectedLocation || "Select Location (e.g. Whitefield)"}
        </span>
        <svg
          className={`${styles.arrowIcon} ${isOpen ? styles.rotated : ""}`}
          viewBox="0 0 24 24"
          width="18"
          height="18"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>

      {isOpen && (
        <div className={styles.dropdownMenu}>
          <div className={styles.searchBox}>
            <svg
              className={styles.searchIcon}
              viewBox="0 0 24 24"
              width="16"
              height="16"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Type to search location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          
          <div className={styles.optionsList}>
            {filteredLocations.length > 0 ? (
              filteredLocations.map((loc) => (
                <div
                  key={loc}
                  className={`${styles.optionItem} ${
                    selectedLocation === loc ? styles.optionSelected : ""
                  }`}
                  onClick={() => handleSelect(loc)}
                >
                  {loc}
                </div>
              ))
            ) : (
              <div className={styles.noResults}>No locations found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
