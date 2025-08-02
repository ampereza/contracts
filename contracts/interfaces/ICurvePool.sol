// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ICurvePool {
    function exchange(
        int128 i,
        int128 j,
        uint256 dx,
        uint256 min_dy
    ) external returns (uint256);
    
    function exchange_underlying(
        int128 i,
        int128 j,
        uint256 dx,
        uint256 min_dy
    ) external returns (uint256);
    
    function get_dy(
        int128 i,
        int128 j,
        uint256 dx
    ) external view returns (uint256);
    
    function get_dy_underlying(
        int128 i,
        int128 j,
        uint256 dx
    ) external view returns (uint256);
    
    function coins(uint256 i) external view returns (address);
    function underlying_coins(uint256 i) external view returns (address);
}

interface ICurveRegistry {
    function find_pool_for_coins(
        address from,
        address to
    ) external view returns (address);
    
    function get_coin_indices(
        address pool,
        address from,
        address to
    ) external view returns (int128, int128, bool);
}
