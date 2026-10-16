import {PackShop} from './PackShop';
import './point-shop.css';

// 設定画面の「ポイント購入」。中身はスカウト画面のシートと同じ PackShop(2026-10-16)。
export function PointShop(){
 return <section className="point-shop" aria-labelledby="point-shop-title">
  <h3 id="point-shop-title">ポイント購入</h3>
  <PackShop/>
 </section>;
}
