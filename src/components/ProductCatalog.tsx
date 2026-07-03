/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Product } from "../types";
import { Sparkles, ShoppingBag, EyeOff, Search } from "lucide-react";

interface ProductCatalogProps {
  products: Product[];
  addToCart: (product: Product) => void;
  cartCount: (productId: string) => number;
}

export default function ProductCatalog({ products, addToCart, cartCount }: ProductCatalogProps) {
  const [selectedCategory, setSelectedCategory] = useState<"all" | "electronics" | "kitchen">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredProducts = products.filter((p) => {
    const matchesCategory = selectedCategory === "all" || p.category === selectedCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div id="product-catalog-section" className="space-y-6">
      {/* Search and Category Filter Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-brand-card/90 border border-brand-border/60 p-4 rounded-xl backdrop-blur">
        {/* Tab Buttons */}
        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <button
            id="tab-all"
            onClick={() => setSelectedCategory("all")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all shrink-0 uppercase tracking-wider ${
              selectedCategory === "all"
                ? "bg-brand-neon text-brand-dark font-bold shadow-[0_0_12px_rgba(204,255,0,0.4)]"
                : "bg-brand-purple/40 text-brand-neon-light hover:bg-brand-purple/60"
            }`}
          >
            All Smart Tech
          </button>
          <button
            id="tab-electronics"
            onClick={() => setSelectedCategory("electronics")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all shrink-0 uppercase tracking-wider ${
              selectedCategory === "electronics"
                ? "bg-brand-neon text-brand-dark font-bold shadow-[0_0_12px_rgba(204,255,0,0.4)]"
                : "bg-brand-purple/40 text-brand-neon-light hover:bg-brand-purple/60"
            }`}
          >
            🔌 Electronics
          </button>
          <button
            id="tab-kitchen"
            onClick={() => setSelectedCategory("kitchen")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all shrink-0 uppercase tracking-wider ${
              selectedCategory === "kitchen"
                ? "bg-brand-neon text-brand-dark font-bold shadow-[0_0_12px_rgba(204,255,0,0.4)]"
                : "bg-brand-purple/40 text-brand-neon-light hover:bg-brand-purple/60"
            }`}
          >
            🍳 Smart Kitchen
          </button>
        </div>

        {/* Search input */}
        <div className="relative w-full md:w-72">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-brand-purple-glow">
            <Search className="w-4 h-4" />
          </span>
          <input
            id="product-search-input"
            type="text"
            placeholder="Search gadgets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-brand-dark/80 border border-brand-border text-white text-sm rounded-lg pl-9 pr-4 py-2 focus:outline-none focus:ring-1 focus:ring-brand-neon focus:border-brand-neon transition"
          />
        </div>
      </div>

      {/* Grid */}
      {filteredProducts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-brand-card/30 border border-brand-border/40 rounded-xl">
          <EyeOff className="w-12 h-12 text-brand-purple-glow mb-3 animate-pulse" />
          <p className="text-gray-400 font-medium">No smart gadgets match your search</p>
          <button
            onClick={() => { setSelectedCategory("all"); setSearchQuery(""); }}
            className="mt-4 px-4 py-2 bg-brand-purple hover:bg-brand-purple-light text-brand-neon font-semibold text-xs rounded-lg transition"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map((product) => {
            const count = cartCount(product.id);
            const isOutOfStock = product.status === "stock_out";

            return (
              <div
                key={product.id}
                id={`product-card-${product.id}`}
                className="group relative flex flex-col justify-between bg-brand-card border border-brand-border/80 hover:border-brand-purple-light/80 rounded-xl overflow-hidden transition-all duration-300 hover:-translate-y-1 shadow-[0_4px_20px_rgba(0,0,0,0.4)] hover:shadow-[0_4px_25px_rgba(124,58,237,0.15)]"
              >
                {/* Image & Badges */}
                <div className="relative aspect-square w-full bg-black/40 overflow-hidden">
                  <img
                    src={product.image}
                    alt={product.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  
                  {/* Status Badges */}
                  <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
                    {product.status === "hot_sale" && (
                      <span className="flex items-center gap-1 bg-red-600 text-white text-[10px] font-extrabold uppercase tracking-wider px-2 py-1 rounded shadow-lg">
                        <Sparkles className="w-3 h-3 fill-current" /> Hot Sale
                      </span>
                    )}
                    {product.status === "stock_out" && (
                      <span className="bg-brand-dark/95 text-red-500 border border-red-500 text-[10px] font-extrabold uppercase tracking-wider px-2 py-1 rounded shadow-lg">
                        Stock Out
                      </span>
                    )}
                    {product.status === "stock_in" && (
                      <span className="bg-green-600 text-white text-[10px] font-extrabold uppercase tracking-wider px-2 py-1 rounded shadow-lg">
                        In Stock
                      </span>
                    )}
                  </div>

                  {/* Quick view overlay when hovered */}
                  <div className="absolute inset-0 bg-brand-dark/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <span className="bg-brand-neon text-brand-dark px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                      ₹{product.price.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Info and action content */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <span className="text-[10px] uppercase tracking-widest text-brand-neon font-bold font-mono">
                      {product.category === "electronics" ? "Electronics" : "Smart Kitchen"}
                    </span>
                    <h3 className="text-white font-semibold text-base tracking-tight mt-1 group-hover:text-brand-neon-light transition-colors line-clamp-1">
                      {product.name}
                    </h3>
                    <p className="text-gray-400 text-xs mt-1.5 line-clamp-2 leading-relaxed">
                      {product.description}
                    </p>
                  </div>

                  <div className="pt-2 flex items-center justify-between gap-2 border-t border-brand-border/40">
                    <span className="text-white font-extrabold text-lg tracking-tight font-display">
                      ₹{product.price.toLocaleString("en-IN")}
                    </span>

                    <button
                      id={`btn-add-to-cart-${product.id}`}
                      disabled={isOutOfStock}
                      onClick={() => addToCart(product)}
                      className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        isOutOfStock
                          ? "bg-brand-dark border border-brand-border text-gray-500 cursor-not-allowed"
                          : "bg-brand-purple text-brand-neon hover:bg-brand-purple-light border border-brand-purple-light/20 shadow-[0_0_10px_rgba(124,58,237,0.2)] active:scale-95"
                      }`}
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      {count > 0 ? `In Cart (${count})` : "Add"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
