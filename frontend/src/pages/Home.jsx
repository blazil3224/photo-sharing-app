import React from 'react';
import { PostList } from '../components/Posts';

const Home = () => {
  return (
    <div className="container mt-4">
      <div className="row">
        <div className="col-lg-8 mx-auto">
          <div className="text-center mb-4">
            <h1 className="display-4">PhotoShare</h1>
            <p className="lead text-muted">
              写真を共有して、素敵な瞬間をみんなと分かち合いましょう
            </p>
          </div>
          
          {/* タイムライン表示エリア */}
          <PostList />
        </div>
      </div>
    </div>
  );
};

export default Home;