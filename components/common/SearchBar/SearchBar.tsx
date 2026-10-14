"use client";

import { Search } from "lucide-react";

type SearchBarProps = {
  onSearch: (value: string) => void;
  placeholder?: string;
};

const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  placeholder = "Search...",
}) => {
  return (
    <div className="relative">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#54656f]" />
      <input
        type="text"
        onChange={(e) => onSearch(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-11 pr-4 py-2 bg-[#f0f2f5] rounded-lg text-[14px] text-[#111b21] placeholder:text-[#54656f] outline-none transition-all focus:bg-white focus:ring-1 focus:ring-[#00a884] border border-transparent focus:border-[#00a884]/30"
      />
    </div>
  );
};

export default SearchBar;
