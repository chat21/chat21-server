import http from 'k6/http';
import { sleep } from 'k6';

export let options = {
  vus: 100,
  duration: '1s',
};

export default function () {
  let host = 'http://localhost:3000'
  let url = host + "/sendDirectMessage";
  http.get(url);
  sleep(1);
}