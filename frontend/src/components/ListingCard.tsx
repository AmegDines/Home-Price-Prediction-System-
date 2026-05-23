"use client";

import React, { useState } from "react";
import { HomeListing, analyzeAskingPrice } from "@/utils/listings";
import styles from "./ListingCard.module.css";

interface ListingCardProps {
  listing: HomeListing;
}

export default function ListingCard({ listing }: ListingCardProps) {
  const [showContact, setShowContact] = useState(false);
  
  const priceAnalysis = analyzeAskingPrice(
    listing.asking_price_lakhs,
    listing.predicted_price_lakhs
  );

  const formatPrice = (lakhs: number) => {
    if (lakhs >= 100) {
      return `₹ ${(lakhs / 100).toFixed(2)} Cr`;
    }
    return `₹ ${lakhs.toFixed(1)} Lakhs`;
  };

  return (
    <div className={styles.cardContainer}>
      <div 
        className={styles.cardImage}
        style={{ backgroundImage: `url(${listing.imageUrl})` }}
      >
        <span className={`${styles.dealBadge} ${styles[priceAnalysis.badgeClass]}`}>
          {priceAnalysis.badgeText}
        </span>
      </div>

      <div className={styles.cardBody}>
        <div className={styles.headerInfo}>
          <span className={styles.locationTag}>
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className={styles.pinIcon}>
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
            {listing.location}
          </span>
          <span className={styles.timestamp}>{listing.created_at.split(' ')[0]}</span>
        </div>

        <h3 className={styles.cardTitle}>{listing.title}</h3>

        <div className={styles.specsGrid}>
          <div className={styles.specItem}>
            <span className={styles.specVal}>{listing.bhk}</span>
            <span className={styles.specLabel}>BHK</span>
          </div>
          <div className={styles.specItem}>
            <span className={styles.specVal}>{listing.bath}</span>
            <span className={styles.specLabel}>Baths</span>
          </div>
          <div className={styles.specItem}>
            <span className={styles.specVal}>{listing.total_sqft}</span>
            <span className={styles.specLabel}>Sq.Ft</span>
          </div>
          <div className={styles.specItem}>
            <span className={styles.specVal}>{listing.balcony}</span>
            <span className={styles.specLabel}>Balcony</span>
          </div>
        </div>

        <div className={styles.valuationReport}>
          <div className={styles.valuationRow}>
            <span className={styles.valuationLabel}>Asking Price</span>
            <span className={styles.askingPrice}>{formatPrice(listing.asking_price_lakhs)}</span>
          </div>
          <div className={styles.valuationRow}>
            <span className={styles.valuationLabel}>AI Predicted Value</span>
            <span className={styles.predictedPrice}>{formatPrice(listing.predicted_price_lakhs)}</span>
          </div>
        </div>

        <div className={styles.footerAction}>
          {showContact ? (
            <div className={styles.contactDetails}>
              <div className={styles.sellerName}>{listing.seller_name}</div>
              <a href={`tel:${listing.seller_phone}`} className={styles.sellerPhone}>
                {listing.seller_phone}
              </a>
            </div>
          ) : (
            <button 
              className={styles.contactBtn}
              onClick={() => setShowContact(true)}
            >
              Contact Seller
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
