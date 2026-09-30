import {useEffect,useState} from 'react';
import {pointProducts,type StoreProduct} from './point-products';
import './point-shop.css';

export function PointShop(){
 const [products,setProducts]=useState<StoreProduct[]>([]);
 useEffect(()=>{let active=true;void window.diamondPointStore?.catalog().then(r=>{if(active)setProducts(r.products);}).catch(()=>{});return()=>{active=false;};},[]);
 return <section className="point-shop" aria-labelledby="point-shop-title">
  <h3 id="point-shop-title">ポイント販売（準備中）</h3>
  <p>スカウトや選手の覚醒に使えるポイントです。</p>
  <div className="point-shop-packs">{pointProducts.map(p=><div className="point-shop-pack" key={p.id}>
   <strong>{p.points.toLocaleString('ja-JP')} <small>pt</small></strong>
   <button type="button" disabled>{products.find(v=>v.id===p.id)?.price??'販売準備中'}</button>
  </div>)}</div>
  <p role="status">ポイントの販売は準備中のため、ここでは購入できません。ポイントは試合・目標達成・スカウト画面の「広告を見て ＋pt」で貯められます。買い切りのプレミアムパスは上の欄から購入できます。</p>
 </section>;
}
