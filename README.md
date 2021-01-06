# Nuber Eats

The Backend of Uber Eats Clone with NestJS, GraphQL and TypeORM

---

### 1. User

#### User Entity

- id
- createdAt
- updatedAt

- email
- password
- role(client|owner|delivery)

#### User CRUD

- Create Account
- Log In
- See Profile
- Edit Profile
- Verify Email

### 2. Restaurant

#### Restaurant Entity

- id
- createdAt
- updatedAt

- name
- category
- address
- coverImage

#### Restaurant CRUD

- Create a restaurant
- Edit a restaurant
- Delete a restaurant

- See Categories
- See Restaurants by Category (pagination)
- See Restaurants (pagination)
- See a restaurant

- Create a dish
- Edit a dish
- Delete a dish

### 4. Orders

- Orders CRUD
  - Make an order
  - Update order status
- Orders Subscription
  - Pending orders (Owner)(s: newOrder)(t: createOrder(newOrder))
  - Order status (Client, Delivery, Owner) (s: orderUpdate)(t: editOrder(orderUpdate))
  - Pending Pickup Order (Delivery) (s: orderUpdate)(t: editOrder(orderUpdate))

### 5. Payments

- paddle
- cron jobs
